import { config } from '../config.ts';

export class ProviderError extends Error {
  constructor(public provider: string, message: string, public retryable = true, public status?: number) {
    super(`[${provider}] ${message}`);
  }
}

/** fetch with an AbortController timeout. */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry with exponential backoff on retryable errors. */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1, baseMs = 600): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (e instanceof ProviderError && !e.retryable) break;
      if (i < retries) await sleep(baseMs * 2 ** i + Math.random() * 200);
    }
  }
  throw last;
}

/* ---------------- Daily budget counters per provider ---------------- */

const counters = new Map<string, { day: string; count: number }>();
const today = () => new Date().toISOString().slice(0, 10);

export function budgetAvailable(provider: string): boolean {
  const limit = config.budgets[provider];
  if (!limit) return true;
  const c = counters.get(provider);
  if (!c || c.day !== today()) return true;
  return c.count < limit * 0.95; // switch provider when near the limit
}

export function budgetUse(provider: string): void {
  const d = today();
  const c = counters.get(provider);
  if (!c || c.day !== d) counters.set(provider, { day: d, count: 1 });
  else c.count++;
}

export function budgetSnapshot(): Record<string, { used: number; limit: number }> {
  const out: Record<string, { used: number; limit: number }> = {};
  for (const [k, limit] of Object.entries(config.budgets)) {
    const c = counters.get(k);
    out[k] = { used: c && c.day === today() ? c.count : 0, limit };
  }
  return out;
}

/* ---------------- Cooldown after rate limits ---------------- */

const cooldowns = new Map<string, number>();
export function inCooldown(provider: string): boolean {
  return (cooldowns.get(provider) ?? 0) > Date.now();
}
export function setCooldown(provider: string, ms: number): void {
  cooldowns.set(provider, Date.now() + ms);
}

/* ---------------- Concurrency limiter ---------------- */

export function limiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}
