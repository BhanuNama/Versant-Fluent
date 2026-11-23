import { config } from '../config.ts';
import { contentTokens } from '../scoring/text.ts';

/**
 * Embeddings: all-MiniLM-L6-v2 via transformers.js (runs locally, free),
 * with a token-overlap fallback when the model cannot load.
 */

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

let extractor: Extractor | null = null;
let loading: Promise<Extractor | null> | null = null;
let failed = config.embeddings === 'overlap';

async function load(): Promise<Extractor | null> {
  if (failed) return null;
  if (extractor) return extractor;
  loading ??= (async () => {
    try {
      const mod: any = await import('@huggingface/transformers');
      if (mod.env) mod.env.cacheDir = `${config.dataDir}/models`;
      const pipe = await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
      extractor = pipe as Extractor;
      console.log('[embeddings] all-MiniLM-L6-v2 loaded');
      return extractor;
    } catch (e) {
      failed = true;
      console.warn('[embeddings] local model unavailable, using token overlap:', (e as Error).message);
      return null;
    }
  })();
  return loading;
}

export function embeddingsMode(): 'local' | 'overlap' {
  return failed ? 'overlap' : 'local';
}

/** Warm the model in the background so the first grading is not slow. */
export function warmEmbeddings(): void {
  void load();
}

const cache = new Map<string, number[]>();

async function embed(texts: string[]): Promise<number[][] | null> {
  const ex = await load();
  if (!ex) return null;
  const missing = texts.filter((t) => !cache.has(t));
  if (missing.length) {
    try {
      const out = await ex(missing, { pooling: 'mean', normalize: true });
      out.tolist().forEach((v, i) => cache.set(missing[i], v));
      if (cache.size > 5000) cache.clear();
    } catch {
      return null;
    }
  }
  return texts.map((t) => cache.get(t)!);
}

function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // vectors are normalized
}

/** Share of reference content tokens present in the hypothesis (0..1). */
export function containment(ref: string, hyp: string): number {
  const r = new Set(contentTokens(ref));
  if (!r.size) return 0;
  const h = new Set(contentTokens(hyp));
  let hit = 0;
  for (const t of r) if (h.has(t)) hit++;
  return hit / r.size;
}

/** Symmetric token-overlap similarity (F1 of content tokens). */
export function overlapSimilarity(a: string, b: string): number {
  const p = containment(a, b);
  const r = containment(b, a);
  return p + r ? (2 * p * r) / (p + r) : 0;
}

export interface SimResult { score: number; mode: 'local' | 'overlap' }

/**
 * Similarity of `ref` against the best-matching candidate text.
 * In local mode: max(cosine, containment) to stay robust for short phrases.
 */
export async function bestSimilarity(ref: string, candidates: string[]): Promise<SimResult> {
  const cands = candidates.map((c) => c.trim()).filter(Boolean);
  if (!cands.length || !ref.trim()) return { score: 0, mode: embeddingsMode() };
  const lexical = Math.max(...cands.map((c) => containment(ref, c)));
  const vecs = await embed([ref, ...cands]);
  if (!vecs) return { score: lexical, mode: 'overlap' };
  const [r, ...cs] = vecs;
  const sem = Math.max(...cs.map((c) => cosine(r, c)));
  return { score: Math.max(sem, lexical * 0.9), mode: 'local' };
}

export async function similarity(a: string, b: string): Promise<SimResult> {
  if (!a.trim() || !b.trim()) return { score: 0, mode: embeddingsMode() };
  const vecs = await embed([a, b]);
  if (!vecs) return { score: overlapSimilarity(a, b), mode: 'overlap' };
  return { score: cosine(vecs[0], vecs[1]), mode: 'local' };
}

/** Thresholds per mode (starting values; tune on learner data, spec 21.5). */
export const THRESHOLDS = {
  local: { idea: 0.62, ideaPartial: 0.5, gHigh: 0.72, gMid: 0.55, element: 0.6 },
  overlap: { idea: 0.5, ideaPartial: 0.3, gHigh: 0.6, gMid: 0.34, element: 0.45 },
};
