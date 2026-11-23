import { config } from '../config.ts';
import { ProviderError, budgetAvailable, budgetUse, fetchWithTimeout, inCooldown, limiter, setCooldown, withRetry } from './util.ts';

/**
 * LLM provider layer. All three free providers expose an OpenAI-compatible
 * chat completions endpoint, so a single implementation covers them.
 * Fallback order: Groq -> Gemini -> OpenRouter.
 */

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

interface LlmProvider {
  name: 'groq' | 'gemini' | 'openrouter';
  url: string;
  key: string;
  model: string;
  jsonMode: boolean;
}

function providers(): LlmProvider[] {
  const list: LlmProvider[] = [];
  if (config.keys.groq) list.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: config.keys.groq, model: config.models.groq, jsonMode: true });
  if (config.keys.gemini) list.push({ name: 'gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: config.keys.gemini, model: config.models.gemini, jsonMode: true });
  if (config.keys.openrouter) list.push({ name: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions', key: config.keys.openrouter, model: config.models.openrouter, jsonMode: false });
  return list;
}

export function llmProviderNames(): string[] {
  return providers().map((p) => p.name);
}

/** Providers usable right now (configured, within budget, not cooling down). */
export function availableLlms(): string[] {
  return providers().filter((p) => budgetAvailable(p.name) && !inCooldown(p.name)).map((p) => p.name);
}

const run = limiter(3);

async function callOnce(p: LlmProvider, messages: ChatMessage[], temperature: number): Promise<string> {
  const body: Record<string, unknown> = { model: p.model, messages, temperature, max_tokens: 3000 };
  if (p.jsonMode) body.response_format = { type: 'json_object' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` };
  if (p.name === 'openrouter') {
    headers['HTTP-Referer'] = config.clientOrigins[0] ?? 'http://localhost';
    headers['X-Title'] = 'FluentPath';
  }
  budgetUse(p.name);
  const res = await fetchWithTimeout(p.url, { method: 'POST', headers, body: JSON.stringify(body) }, 30_000);
  if (res.status === 429) {
    const ra = Number(res.headers.get('retry-after'));
    setCooldown(p.name, (Number.isFinite(ra) && ra > 0 ? ra : 20) * 1000);
    throw new ProviderError(p.name, 'rate limited', false, 429);
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError(p.name, `auth error ${res.status}`, false, res.status);
  if (!res.ok) throw new ProviderError(p.name, `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status >= 500, res.status);
  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new ProviderError(p.name, 'empty completion');
  return content;
}

/** Extract the first JSON object from a completion (handles code fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object found');
  return JSON.parse(src.slice(start, end + 1));
}

/**
 * Call a specific provider and return parsed + validated JSON.
 * Retries once on invalid JSON (spec 8.4).
 */
export async function chatJsonWith<T>(
  providerName: string,
  messages: ChatMessage[],
  validate: (v: unknown) => T,
  temperature = 0,
): Promise<T> {
  const p = providers().find((x) => x.name === providerName);
  if (!p) throw new ProviderError(providerName, 'not configured', false);
  return run(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await withRetry(() => callOnce(p, messages, temperature), 1);
      try {
        return validate(extractJson(text));
      } catch (e) {
        lastErr = e;
      }
    }
    throw new ProviderError(p.name, `invalid JSON output: ${(lastErr as Error)?.message}`);
  });
}

/** Try providers in fallback order until one succeeds. */
export async function chatJson<T>(messages: ChatMessage[], validate: (v: unknown) => T, temperature = 0): Promise<{ value: T; provider: string }> {
  const errors: string[] = [];
  for (const name of availableLlms()) {
    try {
      return { value: await chatJsonWith(name, messages, validate, temperature), provider: name };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  throw new ProviderError('llm', errors.length ? errors.join(' | ') : 'no LLM provider configured', false);
}
