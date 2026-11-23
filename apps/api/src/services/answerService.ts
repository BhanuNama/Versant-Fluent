import { SCORING_VERSION, type PartId } from '@fluentpath/shared';
import { db } from '../db/index.ts';
import { newId, nowIso } from '../db/store.ts';
import type { AnswerDoc, JobDoc, SessionDoc } from '../db/types.ts';
import { INSTANT_PARTS, scoreInstant } from '../scoring/index.ts';
import { checkDeadline } from './sessionService.ts';
import { kickWorker } from './jobWorker.ts';

export interface SubmitTextParams {
  session: SessionDoc;
  itemId: string;
  sub?: number | null;
  text?: string;
  choice?: number;
  choices?: number[];
  clientElapsedMs?: number;
  integrity?: { pasted: boolean; pasteChars: number };
}

export interface SubmitAudioParams {
  session: SessionDoc;
  itemId: string;
  sub?: number | null;
  audioPath: string;
  mimeType: string;
  durationMs: number;
}

export async function submitTextAnswer(params: SubmitTextParams): Promise<{ accepted: boolean; answerId: string }> {
  const { session, itemId, sub = null, text, choice, choices, clientElapsedMs = 0, integrity } = params;

  // Deadline check
  const withinDeadline = checkDeadline(session, itemId, sub);
  if (!withinDeadline) {
    throw new Error('DEADLINE_EXCEEDED: Answer submitted past the allowable time limit.');
  }

  const item = await db().items.get(itemId);
  if (!item) throw new Error('Item not found');

  const key = sub !== null ? `${itemId}:${sub}` : itemId;
  const existing = await db().answers.findOne({ sessionId: session._id, key });
  if (existing) {
    return { accepted: true, answerId: existing._id };
  }

  const answerDoc: AnswerDoc = {
    _id: newId('ans'),
    sessionId: session._id,
    userId: session.userId,
    itemId,
    sub,
    key,
    part: item.part,
    raw: {
      text,
      choice,
      choices,
    },
    integrity,
    submittedAt: nowIso(),
    timeTakenMs: clientElapsedMs,
    transcript: null,
    transcriptSource: null,
    itemScore: null,
    flags: [],
    provisional: false,
    scoringStatus: 'pending',
    scoringVersion: SCORING_VERSION,
  };

  // If item is instant, score immediately
  if (INSTANT_PARTS.includes(item.part)) {
    const scoredPatch = scoreInstant(answerDoc, item);
    Object.assign(answerDoc, scoredPatch);
  } else {
    // Queue scoring job for async part (B, D)
    const jobDoc: JobDoc = {
      _id: newId('job'),
      answerId: answerDoc._id,
      sessionId: session._id,
      type: 'score',
      status: 'queued',
      stage: null,
      attempts: 0,
      lastError: null,
      runAfter: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await db().jobs.insert(jobDoc);
  }

  await db().answers.insert(answerDoc);

  // Trigger worker asynchronously
  if (!INSTANT_PARTS.includes(item.part)) {
    kickWorker();
  }

  return { accepted: true, answerId: answerDoc._id };
}

export async function submitAudioAnswer(params: SubmitAudioParams): Promise<{ accepted: boolean; answerId: string; jobId?: string }> {
  const { session, itemId, sub = null, audioPath, mimeType, durationMs } = params;

  // Deadline check
  const withinDeadline = checkDeadline(session, itemId, sub);
  if (!withinDeadline) {
    throw new Error('DEADLINE_EXCEEDED: Audio submitted past the allowable time limit.');
  }

  const item = await db().items.get(itemId);
  if (!item) throw new Error('Item not found');

  const key = sub !== null ? `${itemId}:${sub}` : itemId;
  const existing = await db().answers.findOne({ sessionId: session._id, key });
  if (existing) {
    return { accepted: true, answerId: existing._id };
  }

  const answerDoc: AnswerDoc = {
    _id: newId('ans'),
    sessionId: session._id,
    userId: session.userId,
    itemId,
    sub,
    key,
    part: item.part,
    raw: {
      audioPath,
      mimeType,
      durationMs,
    },
    submittedAt: nowIso(),
    timeTakenMs: durationMs,
    transcript: null,
    transcriptSource: null,
    itemScore: null,
    flags: [],
    provisional: false,
    scoringStatus: 'pending',
    scoringVersion: SCORING_VERSION,
  };

  await db().answers.insert(answerDoc);

  const jobDoc: JobDoc = {
    _id: newId('job'),
    answerId: answerDoc._id,
    sessionId: session._id,
    type: 'score',
    status: 'queued',
    stage: 'transcribing',
    attempts: 0,
    lastError: null,
    runAfter: nowIso(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await db().jobs.insert(jobDoc);
  kickWorker();

  return { accepted: true, answerId: answerDoc._id, jobId: jobDoc._id };
}
