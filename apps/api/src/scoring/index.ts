import { SCORING_VERSION, clampGse, type PartId } from '@fluentpath/shared';
import type { AnswerDoc, ItemDoc, JudgeSummary } from '../db/types.ts';
import { checkGrammar, grammarScore } from '../providers/grammar.ts';
import { THRESHOLDS, bestSimilarity, containment, embeddingsMode, similarity } from '../providers/embeddings.ts';
import { sttAvailable, transcribe } from '../providers/stt.ts';
import { judge, rubric01 } from './judge.ts';
import { scoreChoice, scoreDictation, scoreRepeat, scoreSentenceCompletion } from './objective.ts';
import { inverseRasch } from './rasch.ts';
import { speechMetrics } from './speech.ts';
import { englishRatio, latinRatio, lexicalDiversity, repetitionRatio, sentences, tokens, verbatimRatio, wordCount } from './text.ts';

export type Patch = Partial<AnswerDoc>;
export type StageFn = (stage: 'transcribing' | 'grammar' | 'scoring') => Promise<void>;

export const INSTANT_PARTS: PartId[] = ['A', 'C', 'E', 'F'];
export const SPEAKING_PARTS: PartId[] = ['G', 'H', 'I', 'J'];

const clip = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/* ------------------------------------------------------------------ */
/* Instant (deterministic) parts: A, C, E, F                           */
/* ------------------------------------------------------------------ */

export function scoreInstant(answer: AnswerDoc, item: ItemDoc): Patch {
  const base: Patch = { scoringStatus: 'scored', scoringVersion: SCORING_VERSION, provisional: false };
  switch (item.part) {
    case 'A': {
      const r = scoreSentenceCompletion(answer.raw.text ?? '', item.answerKey.accepted ?? []);
      return { ...base, itemScore: r.score, obs: [{ b: item.gse, x: r.score }], feedback: r.feedback, tips: r.tips };
    }
    case 'C': {
      const key: number[] = item.answerKey.answers ?? [];
      const qg: number[] = item.answerKey.questionGse ?? key.map(() => item.gse);
      const choices = answer.raw.choices ?? [];
      const xs = key.map((k, i) => scoreChoice(choices[i], k));
      const correct = xs.filter((x) => x === 1).length;
      const tips = correct < key.length ? ['Look for words in the options that paraphrase the passage, not ones that repeat it word for word.'] : [];
      return {
        ...base,
        itemScore: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0,
        obs: xs.map((x, i) => ({ b: qg[i] ?? item.gse, x, guess: 0.25 })),
        feedback: `${correct} of ${key.length} questions correct.`,
        tips,
      };
    }
    case 'E': {
      const r = scoreDictation(item.content.text, answer.raw.text ?? '');
      return { ...base, itemScore: r3(r.score), obs: [{ b: item.gse, x: r.score }], feedback: r.feedback, tips: r.tips, alignment: r.alignment ?? null };
    }
    case 'F': {
      const expected = item.answerKey.answer ?? item.answerKey.correct ?? 0;
      const x = scoreChoice(answer.raw.choice, expected);
      return {
        ...base,
        itemScore: x,
        obs: [{ b: item.gse, x, guess: 0.33 }],
        feedback: x ? 'Correct response.' : 'Not the most appropriate response.',
        tips: x ? [] : ['Pick the reply that directly answers the speaker. Distractors often repeat a word from the prompt.'],
      };
    }
    default:
      throw new Error(`part ${item.part} is not instant`);
  }
}

/* ------------------------------------------------------------------ */
/* Speech helpers                                                      */
/* ------------------------------------------------------------------ */

async function ensureTranscript(answer: AnswerDoc, stage: StageFn): Promise<Patch> {
  if (answer.transcript !== null && answer.transcript !== undefined) return {};
  if (!answer.raw.audioPath) return { transcript: '', transcriptSource: null };
  if (!sttAvailable()) throw new Error('NO_STT');
  await stage('transcribing');
  const t = await transcribe(answer.raw.audioPath, answer.raw.mimeType ?? 'audio/webm');
  return { transcript: t.text, words: t.words, noSpeechProb: t.noSpeechProb, avgLogprob: t.avgLogprob, transcriptSource: 'groq' };
}

/** Guardrails for spoken production (spec 22.8). Returns a reason when the item must score 0. */
function speechGuard(transcript: string, noSpeechProb: number | null | undefined, minWords: number): string | null {
  const n = tokens(transcript).length;
  if (n < minWords || (noSpeechProb ?? 0) > 0.6) return 'no_speech';
  if (latinRatio(transcript) < 0.7 || (n >= 6 && englishRatio(transcript) < 0.12)) return 'non_english';
  return null;
}

const GUARD_FEEDBACK: Record<string, string> = {
  no_speech: 'We could not hear enough speech in this answer. Re-check your microphone and speak a little louder.',
  non_english: 'The response did not appear to be in English, so it could not be scored.',
};

/* ------------------------------------------------------------------ */
/* Async parts: B, D, G, H, I, J                                       */
/* ------------------------------------------------------------------ */

export async function scoreAsync(answer: AnswerDoc, item: ItemDoc, stage: StageFn): Promise<Patch> {
  const base: Patch = { scoringStatus: 'scored', scoringVersion: SCORING_VERSION };
  switch (item.part) {
    case 'B': return { ...base, ...(await scoreReconstruction(answer, item, stage)) };
    case 'D': return { ...base, ...(await scoreEmail(answer, item, stage)) };
    case 'G': case 'H': case 'I': case 'J': {
      const t = await ensureTranscript(answer, stage);
      const a: AnswerDoc = { ...answer, ...t } as AnswerDoc;
      const metrics = speechMetrics(a.words, a.transcript ?? '', a.raw.durationMs ?? 0, a.avgLogprob);
      await stage('scoring');
      const merged = { ...a, metrics };
      const scored =
        item.part === 'G' ? await scoreListenAnswer(merged, item)
        : item.part === 'H' ? scoreRepeatItem(merged, item)
        : item.part === 'I' ? await scoreSituation(merged, item)
        : await scoreRetell(merged, item);
      return { ...base, ...t, metrics, ...scored };
    }
    default:
      return { ...base, ...scoreInstant(answer, item) };
  }
}

/* ---------------- G: passage comprehension ---------------- */

async function scoreListenAnswer(a: AnswerDoc, item: ItemDoc): Promise<Patch> {
  const sub = a.sub ?? 0;
  const expected: string[] = item.answerKey.expected?.[sub] ?? [];
  const b = item.answerKey.questionGse?.[sub] ?? item.gse;
  const transcript = a.transcript ?? '';
  if (tokens(transcript).length < 1 || (a.noSpeechProb ?? 0) > 0.6) {
    return { itemScore: 0, obs: [{ b, x: 0 }], provisional: false, flags: [...a.flags, 'no_speech'], feedback: GUARD_FEEDBACK.no_speech, tips: [] };
  }
  let best = 0;
  for (const e of expected) {
    const kw = containment(e, transcript);
    const sem = (await bestSimilarity(e, [transcript])).score;
    best = Math.max(best, kw, sem);
  }
  const th = THRESHOLDS[embeddingsMode()];
  const x = best >= th.gHigh ? 1 : best >= th.gMid ? 0.5 : 0;
  return {
    itemScore: x,
    obs: [{ b, x }],
    provisional: false,
    feedback: x === 1 ? 'Correct answer.' : x === 0.5 ? 'Partly correct.' : 'This did not match the expected answer.',
    tips: x < 1 ? [`Expected answer: "${expected[0] ?? ''}". Listen for who, what, why and when while the passage plays.`] : [],
  };
}

/* ---------------- H: repeat ---------------- */

function scoreRepeatItem(a: AnswerDoc, item: ItemDoc): Patch {
  const transcript = a.transcript ?? '';
  const guard = speechGuard(transcript, a.noSpeechProb, Math.min(3, tokens(item.content.text).length));
  if (guard) return { itemScore: 0, obs: [{ b: item.gse, x: 0 }], provisional: false, flags: [...a.flags, guard], feedback: GUARD_FEEDBACK[guard], tips: [] };
  const r = scoreRepeat(item.content.text, transcript, a.metrics?.fluency ?? 0.5);
  return { itemScore: r3(r.score), obs: [{ b: item.gse, x: r.score }], provisional: false, alignment: r.alignment, feedback: r.feedback, tips: r.tips };
}

/* ---------------- Fluency / pronunciation GSE adjustments ---------------- */

function speakingAdjust(a: AnswerDoc): number {
  const fl = a.metrics?.fluency ?? 0.7;
  const pron = a.metrics?.pronunciation;
  const flAdj = clip((fl - 0.7) * 10, -5, 5); // spec 22.6
  const pronAdj = pron === null || pron === undefined ? 0 : clip((pron - 0.7) * 6, -2, 2); // low weight (<15%)
  return flAdj + pronAdj;
}

function directFrom(j: JudgeSummary | null, gse: number) {
  if (!j) return { gse: clampGse(gse), sd: 9, disagreement: 0 };
  return { gse: clampGse(gse), sd: 6 + Math.min(6, j.disagreement / 2), disagreement: j.disagreement };
}

/* ---------------- I: speaking situations ---------------- */

async function scoreSituation(a: AnswerDoc, item: ItemDoc): Promise<Patch> {
  const transcript = a.transcript ?? '';
  const guard = speechGuard(transcript, a.noSpeechProb, 3);
  if (guard) return zeroJudged(a, item, guard);
  const expectations: string[] = item.rubric?.expectations ?? [];
  const j = await judge(item._id, a.sub, {
    part: 'I',
    taskText: item.content.situation,
    details: expectations.length ? `A strong response would: ${expectations.join('; ')}.` : '',
    response: transcript,
  });
  const fl = a.metrics?.fluency ?? 0.5;
  const flags = [...a.flags];
  const tips = speakingTips(a);
  if (repetitionRatio(transcript) > 0.4) flags.push('repetitive');
  let x: number;
  let gse: number;
  if (j) {
    x = 0.6 * rubric01(j.dims) + 0.4 * fl;
    gse = j.gse + speakingAdjust(a);
    if (!j.onTopic) { x = Math.min(x, 0.3); gse = Math.min(gse, inverseRasch(item.gse, 0.3)); flags.push('off_topic'); }
    if (j.flagged) flags.push('judges_disagree');
  } else {
    const wc = tokens(transcript).length;
    const relevance = containment(item.content.situation, transcript);
    x = 0.4 * Math.min(1, wc / 70) + 0.3 * fl + 0.3 * Math.min(1, relevance * 2.5);
    gse = inverseRasch(item.gse, x);
  }
  if (flags.includes('repetitive')) { x = Math.min(x, 0.2); gse = Math.min(gse, inverseRasch(item.gse, 0.2)); }
  return {
    itemScore: r3(x),
    direct: directFrom(j, gse),
    judge: j,
    provisional: !j,
    flags,
    feedback: j?.comment || provisionalNote('situation'),
    tips,
  };
}

/* ---------------- J: story retelling ---------------- */

async function scoreRetell(a: AnswerDoc, item: ItemDoc): Promise<Patch> {
  const transcript = a.transcript ?? '';
  const guard = speechGuard(transcript, a.noSpeechProb, 3);
  if (guard) return zeroJudged(a, item, guard);
  const elements: string[] = item.answerKey.elements ?? [];
  const sents = [transcript, ...sentences(transcript)];
  const th = THRESHOLDS[embeddingsMode()];
  let covered = 0;
  const missing: string[] = [];
  for (const e of elements) {
    const s = (await bestSimilarity(e, sents)).score;
    if (s >= th.element) covered += 1;
    else if (s >= th.element * 0.75) covered += 0.5;
    else missing.push(e);
  }
  const coverage = elements.length ? covered / elements.length : 0;
  const j = await judge(item._id, a.sub, {
    part: 'J',
    taskText: `Retell this story: "${item.content.story}"`,
    details: `Story elements to cover: ${elements.join('; ')}.`,
    response: transcript,
  });
  const fl = a.metrics?.fluency ?? 0.5;
  const flags = [...a.flags];
  let x: number;
  let gse: number;
  if (j) {
    x = 0.35 * coverage + 0.35 * rubric01(j.dims) + 0.3 * fl;
    gse = j.gse + speakingAdjust(a);
    if (j.flagged) flags.push('judges_disagree');
    if (!j.onTopic) { x = Math.min(x, 0.3); gse = Math.min(gse, inverseRasch(item.gse, 0.3)); flags.push('off_topic'); }
  } else {
    x = 0.6 * coverage + 0.4 * fl;
    gse = inverseRasch(item.gse, x);
  }
  if (repetitionRatio(transcript) > 0.4) { flags.push('repetitive'); x = Math.min(x, 0.2); gse = Math.min(gse, inverseRasch(item.gse, 0.2)); }
  const tips = speakingTips(a);
  if (missing.length) tips.unshift(`Missing story points: ${missing.slice(0, 3).join('; ')}.`);
  return {
    itemScore: r3(x),
    direct: directFrom(j, gse),
    judge: j,
    provisional: !j,
    flags,
    feedback: j?.comment || `You covered about ${Math.round(coverage * 100)}% of the story points. ${provisionalNote('retelling')}`,
    tips,
  };
}

function zeroJudged(a: AnswerDoc, item: ItemDoc, reason: string): Patch {
  return {
    itemScore: 0,
    direct: { gse: inverseRasch(item.gse, 0.05), sd: 6, disagreement: 0 },
    provisional: false,
    flags: [...a.flags, reason],
    feedback: GUARD_FEEDBACK[reason] ?? 'This response could not be scored.',
    tips: [],
    judge: null,
  };
}

function speakingTips(a: AnswerDoc): string[] {
  const m = a.metrics;
  if (!m) return [];
  const tips: string[] = [];
  if (m.wpm < 100) tips.push(`Your pace was about ${Math.round(m.wpm)} words per minute. Aim for 110 to 160 by speaking in longer phrases.`);
  if (m.wpm > 175) tips.push('You spoke quite fast. Slow down slightly so every word is clear.');
  if (m.longPauses >= 2) tips.push(`There were ${m.longPauses} long pauses. Use linking phrases like "and then" or "after that" to keep going.`);
  if (m.fillersPer100 > 5) tips.push('Try to reduce fillers such as "um" and "uh". A short silent pause sounds more confident.');
  return tips;
}

function provisionalNote(kind: string): string {
  return `Provisional ${kind} score from rule-based checks. It will be re-graded automatically when the AI grader is available.`;
}

/* ---------------- B: passage reconstruction ---------------- */

async function scoreReconstruction(a: AnswerDoc, item: ItemDoc, stage: StageFn): Promise<Patch> {
  const text = (a.raw.text ?? '').trim();
  const passage: string = item.content.passage;
  const ideas: string[] = item.answerKey.keyIdeas ?? [];
  const flags = [...a.flags];
  if (wordCount(text) < 4) {
    return { itemScore: 0, direct: { gse: inverseRasch(item.gse, 0.05), sd: 6, disagreement: 0 }, provisional: false, flags, feedback: 'The answer was too short to score.', tips: ['Write at least one full sentence for each key idea.'] };
  }
  if (latinRatio(text) < 0.7 || englishRatio(text) < 0.12) {
    flags.push('non_english');
    return { itemScore: 0, direct: { gse: inverseRasch(item.gse, 0.05), sd: 6, disagreement: 0 }, provisional: false, flags, feedback: GUARD_FEEDBACK.non_english, tips: [] };
  }
  await stage('grammar');
  const gram = await checkGrammar(text);
  const gScore = grammarScore(gram);
  await stage('scoring');

  const th = THRESHOLDS[embeddingsMode()];
  const sents = [text, ...sentences(text)];
  let covered = 0;
  const missing: string[] = [];
  for (const idea of ideas) {
    const s = (await bestSimilarity(idea, sents)).score;
    if (s >= th.idea) covered += 1;
    else if (s >= th.ideaPartial) covered += 0.5;
    else missing.push(idea);
  }
  const coverage = ideas.length ? covered / ideas.length : 0;
  const overall = (await similarity(passage, text)).score;
  const det = 0.5 * coverage + 0.3 * clip(overall, 0, 1) + 0.2 * gScore;

  const j = await judge(item._id, a.sub, {
    part: 'B',
    taskText: 'Reconstruct the passage from memory in your own words, keeping all key ideas.',
    details: `Source passage: "${passage}"\nKey ideas: ${ideas.join('; ')}.`,
    response: text,
  });

  let x = j ? 0.5 * det + 0.5 * rubric01(j.dims) : det;
  let gse = j ? j.gse + clip((det - 0.6) * 10, -4, 4) : inverseRasch(item.gse, det);
  if (j?.flagged) flags.push('judges_disagree');

  // Copy penalty only when text was pasted from the source (spec 8.2 B).
  const verbatim = verbatimRatio(passage, text);
  if (a.integrity?.pasted && verbatim > 0.6) {
    flags.push('copied_source');
    x = Math.min(x, 0.2);
    gse = Math.min(gse, inverseRasch(item.gse, 0.2));
  }
  if (repetitionRatio(text) > 0.4) { flags.push('repetitive'); x = Math.min(x, 0.2); gse = Math.min(gse, inverseRasch(item.gse, 0.2)); }

  const tips: string[] = [];
  if (missing.length) tips.push(`Missing ideas: ${missing.slice(0, 3).join('; ')}.`);
  if (gScore < 0.7) tips.push('Proofread for grammar: check verb tenses and articles.');
  return {
    itemScore: r3(x),
    direct: directFrom(j, gse),
    judge: j,
    grammar: gram.issues,
    provisional: !j,
    flags,
    feedback: j?.comment || `You kept about ${Math.round(coverage * 100)}% of the key ideas. ${provisionalNote('writing')}`,
    tips,
  };
}

/* ---------------- D: email writing ---------------- */

const GREETING = /^\s*(dear|hi|hello|good (morning|afternoon|evening)|greetings|respected)\b/i;
const CLOSING = /\b(regards|sincerely|best wishes|thank you|thanks|yours|cheers|warm wishes|best)\b[\s,.!]*\n?\s*[A-Z]?[\w .]*\s*$/i;

async function scoreEmail(a: AnswerDoc, item: ItemDoc, stage: StageFn): Promise<Patch> {
  const text = (a.raw.text ?? '').trim();
  const flags = [...a.flags];
  const wc = wordCount(text);
  const minWords: number = item.content.minWords ?? 100;
  if (wc < 5) {
    return { itemScore: 0, direct: { gse: inverseRasch(item.gse, 0.05), sd: 6, disagreement: 0 }, provisional: false, flags, feedback: 'The email was too short to score.', tips: [`Write at least ${minWords} words.`] };
  }
  if (latinRatio(text) < 0.7 || englishRatio(text) < 0.12) {
    flags.push('non_english');
    return { itemScore: 0, direct: { gse: inverseRasch(item.gse, 0.05), sd: 6, disagreement: 0 }, provisional: false, flags, feedback: GUARD_FEEDBACK.non_english, tips: [] };
  }
  await stage('grammar');
  const gram = await checkGrammar(text);
  const gScore = grammarScore(gram);
  await stage('scoring');

  const themes: { name: string; keywords: string[] }[] = item.answerKey.themes ?? [];
  const low = ` ${tokens(text).join(' ')} `;
  const themeHits = themes.map((t) => t.keywords.some((k) => low.includes(` ${tokens(k).join(' ')} `)));
  const themeCov = themes.length ? themeHits.filter(Boolean).length / themes.length : 1;
  const hasGreeting = GREETING.test(text);
  const hasClosing = CLOSING.test(text.slice(-160));

  const j = await judge(item._id, a.sub, {
    part: 'D',
    taskText: item.content.task,
    details: `Recipient: ${item.content.recipient}\nRequired themes: ${(item.content.points ?? []).join(', ')}\nMinimum length: ${minWords} words. The candidate wrote ${wc} words.`,
    response: text,
  });

  let x: number;
  let gse: number;
  if (j) {
    x = rubric01(j.dims);
    gse = j.gse;
    if (j.flagged) flags.push('judges_disagree');
  } else {
    x = 0.35 * themeCov + 0.2 * Math.min(1, wc / minWords) + 0.25 * gScore + 0.1 * ((+hasGreeting + +hasClosing) / 2) + 0.1 * Math.min(1, lexicalDiversity(text) * 1.6);
    gse = inverseRasch(item.gse, x);
  }
  // Deterministic adjustments
  if (wc < minWords) { x -= 0.05; gse -= 2; }
  if (!hasGreeting || !hasClosing) { x -= 0.03; gse -= 1; }
  // Caps (applied after the median, spec 22.7)
  if (wc < 60) { x = Math.min(x, 0.4); gse = Math.min(gse, inverseRasch(item.gse, 0.4)); flags.push('too_short'); }
  const offTopic = (j && !j.onTopic) || themeCov === 0;
  if (offTopic) { x = Math.min(x, 0.3); gse = Math.min(gse, inverseRasch(item.gse, 0.3)); flags.push('off_topic'); }
  if (repetitionRatio(text) > 0.4) { x = Math.min(x, 0.2); gse = Math.min(gse, inverseRasch(item.gse, 0.2)); flags.push('repetitive'); }
  if (a.integrity?.pasted && (a.integrity.pasteChars ?? 0) > 80) flags.push('pasted_text');

  const tips: string[] = [];
  if (wc < minWords) tips.push(`Your email has ${wc} words. Aim for at least ${minWords}.`);
  if (!hasGreeting) tips.push('Start with a greeting such as "Dear Ms. Rao,".');
  if (!hasClosing) tips.push('End with a closing such as "Best regards," and your name.');
  themes.forEach((t, i) => { if (!themeHits[i]) tips.push(`Cover the point about ${t.name} with a supporting reason.`); });
  if (gScore < 0.7) tips.push('Proofread: several grammar or spelling issues were found.');

  return {
    itemScore: r3(clip(x, 0, 1)),
    direct: directFrom(j, gse),
    judge: j,
    grammar: gram.issues,
    provisional: !j,
    flags,
    feedback: j?.comment || provisionalNote('email'),
    tips,
  };
}
