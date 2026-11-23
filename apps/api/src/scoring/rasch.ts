import { clampGse } from '@fluentpath/shared';
import type { DirectObs, RaschObs } from '../db/types.ts';

/** GSE points per logit (placeholder, tune on learner data). */
export const SCALE = 10;

export interface Prior { mean: number; sd: number }
export const DEFAULT_PRIOR: Prior = { mean: 48, sd: 16 };

/**
 * Expected a posteriori ability estimate on the GSE grid (spec 22.2),
 * extended with direct (Gaussian) observations from judged items so that
 * Rasch items and judge-based items combine in one estimate per skill.
 * Uses log-sum-exp for numerical stability with many items.
 */
export function eap(items: RaschObs[], direct: DirectObs[] = [], prior: Prior = DEFAULT_PRIOR): { gse: number; sd: number } {
  const grid: number[] = [];
  const logs: number[] = [];
  for (let t = 10; t <= 90; t += 0.5) {
    let logL = -0.5 * ((t - prior.mean) / prior.sd) ** 2;
    for (const { b, x, guess = 0 } of items) {
      const p0 = 1 / (1 + Math.exp(-(t - b) / SCALE));
      const p = Math.min(0.98, Math.max(0.02, guess + (1 - guess) * p0));
      const xx = Math.max(0, Math.min(1, x));
      logL += xx * Math.log(p) + (1 - xx) * Math.log(1 - p);
    }
    for (const o of direct) {
      logL += -0.5 * ((t - o.gse) / Math.max(1, o.sd)) ** 2;
    }
    grid.push(t);
    logs.push(logL);
  }
  const max = Math.max(...logs);
  let den = 0, m1 = 0, m2 = 0;
  for (let i = 0; i < grid.length; i++) {
    const w = Math.exp(logs[i] - max);
    den += w;
    m1 += w * grid[i];
    m2 += w * grid[i] * grid[i];
  }
  const gse = m1 / den;
  const sd = Math.sqrt(Math.max(0, m2 / den - gse * gse));
  return { gse, sd };
}

/**
 * Single-item maximum-likelihood inverse: the ability at which the expected
 * score on an item of difficulty b equals x. Used for provisional GSE of judged
 * items when no LLM judge is available, and for caps.
 */
export function inverseRasch(b: number, x: number): number {
  const xx = Math.max(0.05, Math.min(0.95, x));
  return clampGse(b + SCALE * Math.log(xx / (1 - xx)));
}
