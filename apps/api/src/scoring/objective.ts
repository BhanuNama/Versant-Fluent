import type { AlignOp } from '@fluentpath/shared';
import { alignWords, canon, charLevenshtein, normalize, tokens } from './text.ts';

export interface ObjectiveResult {
  score: number;
  feedback: string;
  tips: string[];
  alignment?: AlignOp[];
}

/* ---------------- Part A: sentence completion ---------------- */

export function scoreSentenceCompletion(answer: string, accepted: string[]): ObjectiveResult {
  const a = normalize(answer).replace(/\s+/g, ' ');
  const acc = accepted.map((x) => normalize(x));
  if (!a) return { score: 0, feedback: 'No answer was entered.', tips: [`Accepted answers include: ${accepted.slice(0, 3).join(', ')}.`] };
  if (acc.includes(a)) return { score: 1, feedback: 'Correct.', tips: [] };
  if (a.includes(' ')) {
    return { score: 0, feedback: 'Only one word is accepted in this task.', tips: [`Accepted answers include: ${accepted.slice(0, 3).join(', ')}.`] };
  }
  const near = acc.find((w) => w.length >= 4 && charLevenshtein(a, w) === 1);
  if (near) {
    return { score: 0.5, feedback: `Right word, but spelled "${answer.trim()}". The correct spelling is "${near}".`, tips: ['Check spelling: one-letter errors receive half credit.'] };
  }
  return { score: 0, feedback: `"${answer.trim()}" does not fit here.`, tips: [`Accepted answers include: ${accepted.slice(0, 3).join(', ')}.`, 'Read the whole sentence before choosing, including words after the blank.'] };
}

/* ---------------- Parts C and F: multiple choice ---------------- */

export function scoreChoice(choice: number | undefined, answer: number): number {
  return choice === answer ? 1 : 0;
}

/* ---------------- Part E: dictation (spec 22.4) ---------------- */

function marks(s: string): string {
  return (canon(s).match(/[.,?!;:]/g) ?? []).join('');
}

export function scoreDictation(target: string, typed: string): ObjectiveResult {
  const ref = tokens(target);
  const hyp = tokens(typed);
  if (!hyp.length) return { score: 0, feedback: 'No answer was entered.', tips: ['Start typing as soon as you hear the first words.'], alignment: ref.map((r) => ({ op: 'del', ref: r })) };
  const al = alignWords(ref, hyp);
  const wordScore = Math.max(0, 1 - al.distance / Math.max(1, ref.length));

  // Punctuation and capitalization (15% of the item).
  const tm = marks(target);
  const ym = marks(typed);
  const markScore = tm.length ? Math.max(0, 1 - charLevenshtein(tm, ym) / tm.length) : ym.length ? 0.5 : 1;
  const rawTarget = canon(target).split(/\s+/);
  const capsNeeded = rawTarget.filter((w, i) => /^[A-Z]/.test(w) && (i === 0 || !/^I$/.test(w))).map((w) => normalize(w));
  const rawTyped = canon(typed).split(/\s+/);
  const typedCaps = new Set(rawTyped.filter((w) => /^[A-Z]/.test(w)).map((w) => normalize(w)));
  const capScore = capsNeeded.length ? capsNeeded.filter((w) => typedCaps.has(w)).length / capsNeeded.length : 1;
  const punctScore = 0.5 * markScore + 0.5 * capScore;

  const score = Math.max(0, Math.min(1, 0.85 * wordScore + 0.15 * punctScore * wordScore));
  const errors = al.subs + al.dels + al.ins;
  const tips: string[] = [];
  if (al.dels) tips.push('Some words were missed. Try writing a quick shorthand while listening, then expand it.');
  if (al.subs) tips.push('Some words were different from the audio. Check small function words like "a", "the", "to".');
  if (punctScore < 0.75) tips.push('Start with a capital letter and end with the right punctuation mark.');
  return {
    score,
    feedback: errors === 0 ? (punctScore >= 0.99 ? 'Perfect dictation.' : 'All words correct. Check capitals and punctuation.') : `${errors} word error${errors === 1 ? '' : 's'} out of ${ref.length} words.`,
    tips,
    alignment: al.ops,
  };
}

/* ---------------- Part H: repeat (spec 22.5) ---------------- */

export function repeatAccuracy(target: string, transcript: string): { accuracy: number; wer: number; alignment: AlignOp[] } {
  const ref = tokens(target);
  const hyp = tokens(transcript);
  const al = alignWords(ref, hyp, { sub: 1, del: 1, ins: 0.5 });
  const wer = al.distance / Math.max(1, ref.length);
  return { accuracy: Math.max(0, 1 - wer), wer, alignment: al.ops };
}

export function scoreRepeat(target: string, transcript: string, fluency: number): ObjectiveResult & { accuracy: number } {
  const { accuracy, alignment } = repeatAccuracy(target, transcript);
  const score = 0.8 * accuracy + 0.2 * fluency;
  const tips: string[] = [];
  const missed = alignment.filter((o) => o.op === 'del').length;
  const changed = alignment.filter((o) => o.op === 'sub').length;
  if (missed) tips.push('Some words were left out. Focus on holding the whole sentence in memory as one meaning unit.');
  if (changed) tips.push('Some words were replaced. Repeat the exact words, not just the meaning.');
  if (fluency < 0.6) tips.push('Speak at a steady, natural pace without long pauses.');
  return {
    score,
    accuracy,
    alignment,
    feedback: accuracy >= 0.99 ? 'Repeated accurately.' : `About ${Math.round(accuracy * 100)}% of the words matched.`,
    tips,
  };
}
