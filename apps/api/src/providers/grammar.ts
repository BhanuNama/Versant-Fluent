import type { GrammarIssue } from '@fluentpath/shared';
import { config } from '../config.ts';
import { ProviderError, budgetAvailable, budgetUse, fetchWithTimeout, inCooldown, limiter, setCooldown, withRetry } from './util.ts';

export interface GrammarReport {
  issues: GrammarIssue[];
  errorsPer100: number;
  source: 'languagetool' | 'heuristic';
}

const run = limiter(1); // public LanguageTool API: keep it gentle

export function grammarConfigured(): boolean {
  return !!config.languageToolUrl;
}

const IGNORED = new Set(['TYPOGRAPHY', 'CASING_WHITESPACE', 'STYLE', 'REDUNDANCY']);
const IGNORED_RULES = new Set(['WHITESPACE_RULE', 'EN_QUOTES', 'DASH_RULE', 'UPPERCASE_SENTENCE_START', 'COMMA_PARENTHESIS_WHITESPACE', 'PUNCTUATION_PARAGRAPH_END']);

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Very small heuristic fallback when LanguageTool is unreachable. */
function heuristic(text: string): GrammarReport {
  const issues: GrammarIssue[] = [];
  const re = /\b(\w+)\s+\1\b/gi; // doubled words
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    issues.push({ offset: m.index, length: m[0].length, message: 'Repeated word.', replacements: [m[1]], category: 'GRAMMAR' });
  }
  const iLower = /(^|\s)i(\s|')/g;
  while ((m = iLower.exec(text))) {
    issues.push({ offset: m.index + m[1].length, length: 1, message: 'The pronoun "I" is always capitalised.', replacements: ['I'], category: 'CASING' });
  }
  const n = Math.max(1, words(text));
  return { issues, errorsPer100: (issues.length / n) * 100, source: 'heuristic' };
}

export async function checkGrammar(text: string): Promise<GrammarReport> {
  const trimmed = text.trim();
  if (!trimmed) return { issues: [], errorsPer100: 0, source: 'heuristic' };
  if (!config.languageToolUrl || inCooldown('languagetool') || !budgetAvailable('languagetool')) return heuristic(trimmed);
  try {
    return await run(() =>
      withRetry(async () => {
        budgetUse('languagetool');
        const body = new URLSearchParams({ text: trimmed.slice(0, 6000), language: 'en-US', level: 'default' });
        const res = await fetchWithTimeout(
          `${config.languageToolUrl}/v2/check`,
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body },
          12_000,
        );
        if (res.status === 429) {
          setCooldown('languagetool', 60_000);
          throw new ProviderError('languagetool', 'rate limited', false, 429);
        }
        if (!res.ok) throw new ProviderError('languagetool', `HTTP ${res.status}`, res.status >= 500);
        const j = (await res.json()) as any;
        const issues: GrammarIssue[] = (j.matches ?? [])
          .filter((mm: any) => !IGNORED.has(mm.rule?.category?.id) && !IGNORED_RULES.has(mm.rule?.id))
          .map((mm: any) => ({
            offset: mm.offset,
            length: mm.length,
            message: String(mm.message ?? '').slice(0, 240),
            replacements: (mm.replacements ?? []).slice(0, 3).map((r: any) => String(r.value)),
            category: String(mm.rule?.category?.id ?? 'GRAMMAR'),
          }));
        return { issues, errorsPer100: (issues.length / Math.max(1, words(trimmed))) * 100, source: 'languagetool' as const };
      }, 1),
    );
  } catch {
    return heuristic(trimmed);
  }
}

/** Grammar score 0..1 from error density (about 10 errors per 100 words => 0). */
export function grammarScore(report: GrammarReport): number {
  return Math.max(0, Math.min(1, 1 - report.errorsPer100 * 0.1));
}
