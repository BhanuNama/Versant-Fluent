import crypto from 'node:crypto';
import { z } from 'zod';
import { SCORING_VERSION, clampGse, gseToCefr } from '@fluentpath/shared';
import { db } from '../db/index.ts';
import { nowIso } from '../db/store.ts';
import type { JudgeSummary } from '../db/types.ts';
import { availableLlms, chatJsonWith } from '../providers/llm.ts';
import { config } from '../config.ts';
import { DIMENSIONS, LEAK_MARKERS, SYSTEM_PROMPT, buildJudgePrompt, type PromptInput } from './prompts.ts';
import { normalize } from './text.ts';

function makeValidator(part: PromptInput['part']) {
  const dimShape: Record<string, z.ZodTypeAny> = {};
  for (const d of DIMENSIONS[part]) dimShape[d.key] = z.coerce.number().min(0).max(5);
  const schema = z.object({
    ...dimShape,
    cefr: z.string().max(12),
    gse: z.coerce.number().min(10).max(90),
    on_topic: z.union([z.boolean(), z.string().transform((s) => s.toLowerCase() !== 'false')]).optional(),
    comment: z.string().max(600).default(''),
  });
  return (v: unknown) => {
    const parsed = schema.parse(v) as Record<string, any>;
    const comment = String(parsed.comment ?? '').toLowerCase();
    if (LEAK_MARKERS.some((m) => comment.includes(m))) throw new Error('output quotes system instructions');
    return parsed;
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function cacheKey(itemId: string, sub: number | null, part: string, response: string): string {
  return crypto.createHash('sha256').update(`${part}|${itemId}|${sub ?? ''}|${normalize(response)}|${SCORING_VERSION}`).digest('hex');
}

/**
 * Judge ensemble (spec 21.4 / 22.7):
 * two different models x JUDGE_RUNS runs each, median per dimension and median GSE.
 * With a single model: 3 runs (median of 3, spec 8.4).
 * Disagreement > 8 GSE: flag and re-run once with a third model if available.
 * Returns null when every provider fails (caller falls back to provisional scoring).
 */
export async function judge(itemId: string, sub: number | null, input: PromptInput): Promise<JudgeSummary | null> {
  const key = cacheKey(itemId, sub, input.part, input.response);
  const cached = await db().cache.get(key);
  if (cached) return cached.value as JudgeSummary;

  const providers = availableLlms();
  if (!providers.length) return null;

  const validate = makeValidator(input.part);
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: buildJudgePrompt(input) },
  ];

  const plan: string[] = [];
  if (providers.length >= 2) {
    for (let i = 0; i < config.judgeRuns; i++) plan.push(providers[0], providers[1]);
  } else {
    plan.push(providers[0], providers[0], providers[0]);
  }

  const grades: { provider: string; v: Record<string, any> }[] = [];
  const runOne = async (preferred: string) => {
    const order = [preferred, ...providers.filter((p) => p !== preferred)];
    for (const p of order) {
      try {
        const v = await chatJsonWith(p, messages, validate, 0);
        grades.push({ provider: p, v });
        return;
      } catch {
        /* fall through to next provider */
      }
    }
  };
  await Promise.all(plan.map((p) => runOne(p)));
  if (!grades.length) return null;

  let gses = grades.map((g) => clampGse(Number(g.v.gse)));
  let disagreement = Math.max(...gses) - Math.min(...gses);
  if (disagreement > 8 && providers.length >= 3) {
    await runOne(providers[2]);
    gses = grades.map((g) => clampGse(Number(g.v.gse)));
    disagreement = Math.max(...gses) - Math.min(...gses);
  }

  const dims: Record<string, number> = {};
  for (const d of DIMENSIONS[input.part]) dims[d.key] = median(grades.map((g) => Number(g.v[d.key]) || 0));
  const gse = median(gses);
  const onTopicVotes = grades.map((g) => g.v.on_topic !== false);
  const onTopic = onTopicVotes.filter(Boolean).length >= onTopicVotes.length / 2;
  // Comment from the grade closest to the median GSE.
  const closest = [...grades].sort((a, b) => Math.abs(a.v.gse - gse) - Math.abs(b.v.gse - gse))[0];

  const summary: JudgeSummary = {
    dims,
    gse,
    cefr: gseToCefr(gse),
    comment: String(closest.v.comment ?? '').slice(0, 400),
    onTopic,
    grades: grades.length,
    disagreement,
    providers: [...new Set(grades.map((g) => g.provider))],
    flagged: disagreement > 8,
  };
  // Only cache confident ensembles (2+ grades).
  if (grades.length >= 2) await db().cache.insert({ _id: key, value: summary, createdAt: nowIso() }).catch(() => {});
  return summary;
}

/** Mean of rubric dimensions as 0..1. */
export function rubric01(dims: Record<string, number>): number {
  const v = Object.values(dims);
  return v.length ? v.reduce((a, b) => a + b, 0) / (v.length * 5) : 0;
}
