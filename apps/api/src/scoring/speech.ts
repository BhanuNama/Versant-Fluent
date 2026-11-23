import type { SpeechMetrics, Word } from '@fluentpath/shared';
import { tokens } from './text.ts';

const FILLERS = new Set(['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'ah', 'hmm', 'mm', 'eh']);

/** Fluency score from metrics (spec 22.6). */
export function fluencyScore(m: { wpm: number; pauseRatio: number; longPauses: number; fillersPer100: number }): number {
  let s = 1;
  if (m.wpm < 100) s -= (100 - m.wpm) / 200;
  if (m.wpm > 170) s -= (m.wpm - 170) / 200;
  s -= Math.max(0, m.pauseRatio - 0.2) * 1.2;
  s -= Math.min(0.3, m.longPauses * 0.06);
  s -= Math.min(0.2, m.fillersPer100 * 0.02);
  return Math.max(0, Math.min(1, s));
}

/**
 * Pronunciation proxy from Whisper segment confidence (weak signal; spec 8.3).
 * exp(avg_logprob) is mean token probability; map 0.5..0.95 to 0..1.
 */
export function pronunciationProxy(avgLogprob: number | null | undefined): number | null {
  if (avgLogprob === null || avgLogprob === undefined || !Number.isFinite(avgLogprob)) return null;
  const p = Math.exp(avgLogprob);
  return Math.max(0, Math.min(1, (p - 0.5) / 0.45));
}

const clean = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '');

/** Compute speech metrics from word timestamps (spec 8.3). */
export function speechMetrics(
  words: Word[] | undefined,
  transcript: string,
  durationMs: number,
  avgLogprob?: number | null,
): SpeechMetrics {
  const ws = (words ?? []).filter((w) => clean(w.word));
  const pron = pronunciationProxy(avgLogprob);

  if (ws.length < 2) {
    // No timestamps (e.g. some browser transcripts): estimate from duration.
    const n = tokens(transcript).length;
    const minutes = Math.max(0.05, durationMs / 60000);
    const wpm = n / minutes;
    const fillers = tokens(transcript).filter((t) => FILLERS.has(t)).length;
    const m = { wpm, pauseRatio: 0.25, longPauses: 0, fillersPer100: n ? (fillers / n) * 100 : 0 };
    return {
      wordCount: n, wpm: round(wpm), articulationWpm: round(wpm), pauseRatio: 0.25, longPauses: 0,
      fillers, fillersPer100: round(m.fillersPer100), restarts: 0, fluency: n ? round(fluencyScore(m), 3) : 0, pronunciation: pron,
    };
  }

  const span = Math.max(0.3, ws[ws.length - 1].end - ws[0].start);
  let pauseTime = 0;
  let longPauses = 0;
  let fillers = 0;
  let restarts = 0;
  for (let i = 0; i < ws.length; i++) {
    const w = clean(ws[i].word);
    if (FILLERS.has(w)) fillers++;
    if (i > 0) {
      const gap = ws[i].start - ws[i - 1].end;
      if (gap > 0.4) pauseTime += gap;
      if (gap > 1.0) longPauses++;
      const prev = clean(ws[i - 1].word);
      if (w === 'like' && (gap > 0.3 || (ws[i + 1] && ws[i + 1].start - ws[i].end > 0.3))) fillers++;
      if (w && w === prev && w.length > 1) restarts++;
      if (i > 2 && w === clean(ws[i - 2].word) && clean(ws[i - 1].word) === clean(ws[i - 3].word)) restarts++;
    }
  }
  const n = ws.length;
  const contentWords = n - fillers;
  const wpm = (contentWords / span) * 60;
  const articulation = (contentWords / Math.max(0.3, span - pauseTime)) * 60;
  const pauseRatio = pauseTime / span;
  const fillersPer100 = (fillers / n) * 100;
  const fl = fluencyScore({ wpm, pauseRatio, longPauses, fillersPer100 });
  return {
    wordCount: contentWords,
    wpm: round(wpm),
    articulationWpm: round(articulation),
    pauseRatio: round(pauseRatio, 3),
    longPauses,
    fillers,
    fillersPer100: round(fillersPer100),
    restarts,
    fluency: round(fl, 3),
    pronunciation: pron === null ? null : round(pron, 3),
  };
}

function round(v: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}
