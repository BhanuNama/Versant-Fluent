import {
  ANSWER_GRACE_MS,
  PARTS,
  PART_META,
  itemLimitSec,
  type Capabilities,
  type PartId,
  type PublicItem,
  type SessionState,
} from '@fluentpath/shared';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { newId, nowIso } from '../db/store.ts';
import type { AnswerDoc, ItemDoc, SessionDoc } from '../db/types.ts';
import { embeddingsMode } from '../providers/embeddings.ts';
import { grammarConfigured } from '../providers/grammar.ts';
import { availableLlms } from '../providers/llm.ts';
import { sttAvailable } from '../providers/stt.ts';
import { generatePartItems } from './itemGeneratorService.ts';

/**
 * Filter and convert backend ItemDoc to client-safe PublicItem (strips answers/rubrics).
 */
export function toPublicItem(item: ItemDoc): PublicItem {
  const limit = itemLimitSec(item.part);
  const base = { id: item._id, timeLimitSec: limit };

  switch (item.part) {
    case 'A':
      return { ...base, part: 'A', prompt: item.content.prompt };
    case 'B':
      return {
        ...base,
        part: 'B',
        passage: item.content.passage,
        readSec: 30,
        writeSec: 90,
      };
    case 'C':
      return {
        ...base,
        part: 'C',
        title: item.content.title,
        passage: item.content.passage,
        questions: (item.content.questions || []).map((q: any) => ({
          q: q.q,
          options: q.options,
        })),
      };
    case 'D':
      return {
        ...base,
        part: 'D',
        task: item.content.task,
        recipient: item.content.recipient,
        points: item.content.points || [],
        minWords: item.content.minWords || 100,
      };
    case 'E':
      return { ...base, part: 'E' };
    case 'F':
      return {
        ...base,
        part: 'F',
        options: item.content.options || [],
      };
    case 'G':
      return {
        ...base,
        part: 'G',
        questionCount: item.content.questions?.length || 3,
      };
    case 'H':
      return { ...base, part: 'H' };
    case 'I':
      return {
        ...base,
        part: 'I',
        situation: item.content.situation,
        thinkSec: 10,
        speakSec: 60,
      };
    case 'J':
      return { ...base, part: 'J', speakSec: 30, story: item.content?.story };
  }
}

export function getSystemCapabilities(): Capabilities {
  return {
    stt: sttAvailable(),
    llm: availableLlms(),
    grammar: grammarConfigured(),
    embeddings: embeddingsMode(),
  };
}

/**
 * Pick a balanced set of items for a part based on level and GSE / difficulty spread,
 * prioritizing unseen items for this user so questions do not repeat across attempts.
 */
function pickItems(
  allItems: ItemDoc[],
  count: number,
  seenIds: Set<string>,
  level: 'easy' | 'medium' | 'hard' = 'medium'
): ItemDoc[] {
  if (allItems.length <= count) {
    return [...allItems].sort(() => Math.random() - 0.5);
  }

  // Filter candidates matching the target difficulty level
  let levelCandidates = allItems.filter((c) => {
    if (level === 'easy') return c.gse <= 50 || c.difficulty <= 2;
    if (level === 'hard') return c.gse >= 60 || c.difficulty >= 4;
    // medium default
    return (c.gse >= 42 && c.gse <= 66) || (c.difficulty >= 2 && c.difficulty <= 4);
  });

  // If level filter produced too few candidates, fall back to entire pool
  if (levelCandidates.length < count) {
    levelCandidates = allItems;
  }

  const unseen = levelCandidates.filter((c) => !seenIds.has(c._id));
  const seen = levelCandidates.filter((c) => seenIds.has(c._id));

  let pool: ItemDoc[] = [];

  if (unseen.length >= count) {
    // If enough unseen items exist, pick randomly among unseen
    pool = [...unseen].sort(() => Math.random() - 0.5).slice(0, count);
  } else {
    // Take all unseen, fill rest from seen (shuffled)
    const shuffledSeen = [...seen].sort(() => Math.random() - 0.5);
    pool = [...unseen, ...shuffledSeen.slice(0, count - unseen.length)];
  }

  // Sort selected pool by GSE for a balanced difficulty progression
  const sorted = [...pool].sort((a, b) => a.gse - b.gse);
  // Slightly shuffle so items aren't strictly monotone
  return sorted.sort(() => Math.random() - 0.5);
}

export async function createSession(
  userId: string,
  mode: 'full' | 'part',
  targetPart?: PartId,
  level: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<SessionDoc> {
  const parts: PartId[] = mode === 'full' ? [...PARTS] : [targetPart!];
  const itemIds: Partial<Record<PartId, string[]>> = {};

  const allLive = await db().items.find({ status: 'live' });

  // Prioritize unseen questions by checking previous user answers AND previous sessions
  const pastSeenItemIds = new Set<string>();
  const pastAnswers = await db().answers.find({ userId });
  for (const a of pastAnswers) {
    pastSeenItemIds.add(a.itemId);
  }

  const pastSessions = await db().sessions.find({ userId });
  for (const s of pastSessions) {
    if (s.itemIds) {
      for (const list of Object.values(s.itemIds)) {
        if (Array.isArray(list)) {
          for (const id of list) pastSeenItemIds.add(id);
        }
      }
    }
  }

  for (const part of parts) {
    const meta = PART_META[part];
    const needed = mode === 'full' ? meta.fullCount : meta.practiceCount;
    let candidates = allLive.filter((it) => it.part === part);

    // Calculate unseen candidates for this difficulty level
    const levelFiltered = candidates.filter((c) => {
      if (level === 'easy') return c.gse <= 50 || c.difficulty <= 2;
      if (level === 'hard') return c.gse >= 60 || c.difficulty >= 4;
      return (c.gse >= 42 && c.gse <= 66) || (c.difficulty >= 2 && c.difficulty <= 4);
    });

    const unseenInLevel = levelFiltered.filter((c) => !pastSeenItemIds.has(c._id));

    // If unseen items in the target level are insufficient, dynamically generate fresh items with Groq AI!
    if (unseenInLevel.length < needed) {
      const toGenerate = Math.max(needed - unseenInLevel.length + 2, 3);
      try {
        console.log(
          `[sessionService] User ${userId} has only ${unseenInLevel.length}/${needed} unseen items for Part ${part} (${level}). Generating ${toGenerate} brand-new questions via Groq AI...`
        );
        const generated = await generatePartItems(part, toGenerate, level);
        for (const item of generated) {
          await db().items.insert(item);
          candidates.push(item);
          allLive.push(item);
        }
      } catch (genErr: any) {
        console.warn(`[sessionService] Dynamic item generation warning for Part ${part}: ${genErr.message}`);
      }
    }

    const chosen = pickItems(candidates, needed, pastSeenItemIds, level);
    itemIds[part] = chosen.map((c) => c._id);
    for (const c of chosen) {
      pastSeenItemIds.add(c._id);
    }
  }

  const now = new Date();
  const firstPart = parts[0];
  const firstItems = itemIds[firstPart] || [];

  // Calculate part deadline based on sum of items limits + 10s buffer
  const totalSec = firstItems.reduce((acc) => acc + itemLimitSec(firstPart), 10);
  const deadline = new Date(now.getTime() + totalSec * 1000).toISOString();

  const doc: SessionDoc = {
    _id: newId('sess'),
    userId,
    mode,
    parts,
    partIndex: 0,
    itemIds,
    startedAt: now.toISOString(),
    partStartedAt: now.toISOString(),
    partDeadline: deadline,
    partDeadlines: { [firstPart]: deadline },
    itemStarts: {},
    audioPlays: {},
    status: 'in_progress',
    expiresAt: new Date(now.getTime() + config.sessionTtlHours * 3600 * 1000).toISOString(),
    createdAt: now.toISOString(),
  };

  await db().sessions.insert(doc);
  return doc;
}

export async function getSessionState(sessionId: string): Promise<SessionState | null> {
  const session = await db().sessions.get(sessionId);
  if (!session) return null;

  const currentPart = session.parts[session.partIndex] || session.parts[0];
  const curItemIds = session.itemIds[currentPart] || [];

  // Fetch items
  const items = await db().items.find({ _id: { $in: curItemIds } });
  const itemMap = new Map(items.map((i) => [i._id, i]));
  const orderedItems = curItemIds
    .map((id) => itemMap.get(id))
    .filter((it): it is ItemDoc => Boolean(it))
    .map(toPublicItem);

  // Fetch submitted answers for this session
  const answers = await db().answers.find({ sessionId });
  const answeredKeys = answers.map((a) => a.key);

  const itemDeadlines: Record<string, string> = {};
  for (const [key, val] of Object.entries(session.itemStarts)) {
    itemDeadlines[key] = val.deadline;
  }

  const audioPlayed = Object.keys(session.audioPlays);

  return {
    sessionId: session._id,
    mode: session.mode,
    status: session.status,
    parts: session.parts,
    partIndex: session.partIndex,
    part: currentPart,
    serverTime: nowIso(),
    partDeadline: session.partDeadline,
    items: orderedItems,
    answered: answeredKeys,
    itemDeadlines,
    audioPlayed,
    capabilities: getSystemCapabilities(),
  };
}

export async function startItemTimer(
  session: SessionDoc,
  itemId: string,
  sub: number | null = null
): Promise<{ deadline: string }> {
  const key = sub !== null ? `${itemId}:${sub}` : itemId;
  if (session.itemStarts[key]) {
    return { deadline: session.itemStarts[key].deadline };
  }

  const item = await db().items.get(itemId);
  if (!item) throw new Error('Item not found');

  const now = new Date();
  const limitSec = itemLimitSec(item.part);
  const deadline = new Date(now.getTime() + (limitSec + 2) * 1000).toISOString();

  session.itemStarts[key] = {
    startedAt: now.toISOString(),
    deadline,
  };

  await db().sessions.update(session._id, { itemStarts: session.itemStarts });
  return { deadline };
}

export function checkDeadline(session: SessionDoc, itemId: string, sub: number | null): boolean {
  // Practice assessment policy: always accept candidate answers so no speech recording or test submission is lost
  return true;
}

export async function advancePart(session: SessionDoc): Promise<SessionDoc> {
  const nextIndex = session.partIndex + 1;
  if (nextIndex >= session.parts.length) {
    // Last part finished, ready for submission/grading
    await db().sessions.update(session._id, {
      status: 'grading',
      submittedAt: nowIso(),
    });
    session.status = 'grading';
    session.submittedAt = nowIso();
    return session;
  }

  const nextPart = session.parts[nextIndex];
  const nextItemIds = session.itemIds[nextPart] || [];
  const totalSec = nextItemIds.reduce((acc) => acc + itemLimitSec(nextPart), 10);

  const now = new Date();
  const deadline = new Date(now.getTime() + totalSec * 1000).toISOString();

  const patch: Partial<SessionDoc> = {
    partIndex: nextIndex,
    partStartedAt: now.toISOString(),
    partDeadline: deadline,
    partDeadlines: { ...session.partDeadlines, [nextPart]: deadline },
  };

  await db().sessions.update(session._id, patch);
  Object.assign(session, patch);
  return session;
}

export async function recordAudioPlay(session: SessionDoc, itemId: string, sub?: number | null): Promise<boolean> {
  const key = sub !== undefined && sub !== null ? `${itemId}:${sub}` : itemId;
  const count = session.audioPlays[key] || 0;
  if (count >= 1) {
    // Play-once integrity check: already played!
    return false;
  }

  session.audioPlays[key] = count + 1;
  await db().sessions.update(session._id, { audioPlays: session.audioPlays });
  return true;
}
