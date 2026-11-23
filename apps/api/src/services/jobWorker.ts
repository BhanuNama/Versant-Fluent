import type { Response } from 'express';
import type { GradingProgress } from '@fluentpath/shared';
import { db } from '../db/index.ts';
import { newId, nowIso } from '../db/store.ts';
import type { AnswerDoc, ItemDoc, JobDoc, ResultDoc } from '../db/types.ts';
import { scoreAsync } from '../scoring/index.ts';
import { aggregateSession } from '../scoring/aggregate.ts';

// SSE subscribers map: sessionId -> Set of express Responses
const subscribers = new Map<string, Set<Response>>();

export function addSseSubscriber(sessionId: string, res: Response) {
  let set = subscribers.get(sessionId);
  if (!set) {
    set = new Set();
    subscribers.set(sessionId, set);
  }
  set.add(res);

  res.on('close', () => {
    set?.delete(res);
    if (set && set.size === 0) {
      subscribers.delete(sessionId);
    }
  });
}

export function broadcastGradingEvent(sessionId: string, progress: GradingProgress) {
  const set = subscribers.get(sessionId);
  if (!set || set.size === 0) return;

  const data = JSON.stringify(progress);
  for (const res of set) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      // client disconnected
    }
  }
}

let isWorking = false;
let scheduled = false;

export function kickWorker() {
  if (scheduled) return;
  scheduled = true;
  setImmediate(() => {
    scheduled = false;
    runWorkerLoop().catch((err) => {
      console.error('[worker] unhandled loop error:', err);
    });
  });
}

async function runWorkerLoop() {
  if (isWorking) return;
  isWorking = true;

  try {
    let hadWork = true;
    while (hadWork) {
      hadWork = await processNextJob();
    }
  } finally {
    isWorking = false;
  }
}

async function processNextJob(): Promise<boolean> {
  const now = nowIso();
  const filter = {
    status: 'queued',
    runAfter: { $lte: now },
  };

  const job = await db().jobs.claim(
    filter,
    { status: 'running', updatedAt: now },
    { runAfter: 1 }
  );

  if (!job) return false;

  try {
    await executeJob(job);
    await db().jobs.update(job._id, {
      status: 'done',
      stage: null,
      updatedAt: nowIso(),
    });
    // Check if entire session is ready to finalize
    await checkFinalizeSession(job.sessionId);
  } catch (err: any) {
    console.error(`[worker] job ${job._id} failed:`, err.message);
    const attempts = job.attempts + 1;
    const retryable = attempts < 3;
    const backoffMs = Math.min(60000, 2000 * Math.pow(2, attempts));
    const nextRun = new Date(Date.now() + backoffMs).toISOString();

    await db().jobs.update(job._id, {
      status: retryable ? 'queued' : 'failed',
      attempts,
      lastError: err.message,
      runAfter: nextRun,
      updatedAt: nowIso(),
    });

    if (retryable) {
      // Schedule worker wakeup after retry backoff so delayed retries don't stall
      setTimeout(() => kickWorker(), backoffMs + 150);
    } else {
      // Mark answer as failed / zero credit so session doesn't hang forever
      const ans = await db().answers.get(job.answerId);
      if (ans && ans.itemScore === null) {
        await db().answers.update(ans._id, {
          itemScore: 0,
          provisional: true,
          feedback: 'Scoring could not be completed at this time.',
          scoringStatus: 'scored',
        });
      }
      await checkFinalizeSession(job.sessionId);
    }
  }

  return true;
}

async function executeJob(job: JobDoc) {
  const answer = await db().answers.get(job.answerId);
  if (!answer) {
    throw new Error(`Answer ${job.answerId} not found`);
  }

  const item = await db().items.get(answer.itemId);
  if (!item) {
    throw new Error(`Item ${answer.itemId} not found`);
  }

  const stageFn = async (st: 'transcribing' | 'grammar' | 'scoring') => {
    await db().jobs.update(job._id, { stage: st, updatedAt: nowIso() });
    broadcastSessionProgress(job.sessionId, st);
  };

  const patch = await scoreAsync(answer, item, stageFn);

  await db().answers.update(answer._id, {
    ...patch,
    scoringStatus: 'scored',
  });
}

async function broadcastSessionProgress(sessionId: string, currentStage?: 'transcribing' | 'grammar' | 'scoring') {
  const session = await db().sessions.get(sessionId);
  if (!session) return;

  const answers = await db().answers.find({ sessionId });
  const total = answers.length;
  const done = answers.filter((a) => a.scoringStatus === 'scored').length;

  const stage = done === total ? 'done' : (currentStage || 'scoring');

  broadcastGradingEvent(sessionId, {
    status: session.status,
    total,
    done,
    stage,
  });
}

export async function checkFinalizeSession(sessionId: string): Promise<boolean> {
  const session = await db().sessions.get(sessionId);
  if (!session) return false;

  // We finalize if session is in 'grading' status OR all parts are answered
  const answers = await db().answers.find({ sessionId });
  // Reclaim stale 'running' jobs older than 90s and wake queued jobs
  const staleCutoff = new Date(Date.now() - 90_000).toISOString();
  const activeJobs = await db().jobs.find({
    sessionId,
    status: { $in: ['queued', 'running'] },
  });

  if (activeJobs.length > 0) {
    const now = nowIso();
    let shouldKick = false;
    for (const j of activeJobs) {
      if (j.status === 'running' && j.updatedAt < staleCutoff) {
        await db().jobs.update(j._id, { status: 'queued', runAfter: now, updatedAt: now });
        shouldKick = true;
      } else if (j.status === 'queued' && j.runAfter <= now) {
        shouldKick = true;
      }
    }
    if (shouldKick) kickWorker();
    await broadcastSessionProgress(sessionId);
    return false;
  }

  // Check if result already exists
  const existingResult = await db().results.findOne({ sessionId });
  if (existingResult) {
    if (session.status !== 'complete') {
      await db().sessions.update(session._id, { status: 'complete' });
    }
    broadcastGradingEvent(sessionId, {
      status: 'complete',
      total: answers.length,
      done: answers.length,
      stage: 'done',
    });
    return true;
  }

  // If session is grading or all items were submitted
  if (session.status === 'grading' || session.status === 'complete') {
    // Collect all items for this session
    const allItemIds: string[] = [];
    for (const ids of Object.values(session.itemIds)) {
      if (ids) allItemIds.push(...ids);
    }

    const items = await db().items.find({ _id: { $in: allItemIds } });
    const { result } = aggregateSession(session, items, answers);

    const resultDoc: ResultDoc = {
      _id: newId('res'),
      ...result,
      createdAt: nowIso(),
    };

    await db().results.insert(resultDoc);
    await db().sessions.update(session._id, { status: 'complete' });

    broadcastGradingEvent(sessionId, {
      status: 'complete',
      total: answers.length,
      done: answers.length,
      stage: 'done',
    });

    console.log(`[scoring] session ${sessionId} finalized: GSE ${result.gseEstimate} (${result.cefr})`);
    return true;
  }

  return false;
}
