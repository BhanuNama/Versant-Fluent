import type { AlignOp } from '@fluentpath/shared';

const CONTRACTIONS: Record<string, string> = {
  "can't": 'can not', cannot: 'can not', "won't": 'will not', "shan't": 'shall not', "n't": ' not',
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is',
  "it's": 'it is', "that's": 'that is', "there's": 'there is', "what's": 'what is', "let's": 'let us',
  "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have',
  "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will', "he'll": 'he will', "she'll": 'she will', "it'll": 'it will',
  "i'd": 'i would', "you'd": 'you would', "we'd": 'we would', "they'd": 'they would', "he'd": 'he would', "she'd": 'she would',
};

const NUMBERS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '12': 'twelve',
};

/** Unify curly quotes and dashes. */
export function canon(s: string): string {
  return s.replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-');
}

export function expandContractions(s: string): string {
  return s.replace(/\b[a-z]+'[a-z]+\b|\b[a-z]+n't\b/gi, (m) => {
    const low = m.toLowerCase();
    if (CONTRACTIONS[low]) return CONTRACTIONS[low];
    if (low.endsWith("n't")) return low.slice(0, -3) + ' not';
    return low;
  });
}

/** Lowercase, expand contractions, strip punctuation, collapse whitespace. */
export function normalize(s: string): string {
  let t = canon(s).toLowerCase();
  t = expandContractions(t);
  t = t.replace(/o'clock/g, 'oclock');
  t = t.replace(/(\d),(\d)/g, '$1$2');
  t = t.replace(/[^a-z0-9'\s-]/g, ' ').replace(/(^|\s)['-]+|['-]+(\s|$)/g, ' ');
  t = t.replace(/-/g, ' ');
  t = t.replace(/\b\d+\b/g, (d) => NUMBERS[d] ?? d);
  return t.replace(/\s+/g, ' ').trim();
}

export function tokens(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

export const STOPWORDS = new Set(
  'a an the and or but if so to of in on at by for with from as is are was were be been being it its this that these those i you he she we they me him her us them my your his our their do does did have has had will would can could should may might shall must not no than then there here what which who whom when where why how about into over after before up down out off just very also too all any some each more most such only own same both few other s t'.split(' '),
);

/** Light stemmer for overlap matching. */
export function stem(w: string): string {
  if (w.length <= 3) return w;
  return w
    .replace(/(ies)$/, 'y')
    .replace(/(ing|ed|es|s|ly)$/, '')
    .replace(/(.)\1$/, '$1');
}

export function contentTokens(s: string): string[] {
  return tokens(s).filter((t) => !STOPWORDS.has(t)).map(stem);
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Character-level Levenshtein distance. */
export function charLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export interface Alignment { distance: number; ops: AlignOp[]; subs: number; dels: number; ins: number; hits: number }

/**
 * Word-level weighted edit distance with backtrace.
 * ref = target words, hyp = candidate words.
 */
export function alignWords(ref: string[], hyp: string[], costs = { sub: 1, del: 1, ins: 1 }): Alignment {
  const m = ref.length;
  const n = hyp.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) d[i][0] = i * costs.del;
  for (let j = 1; j <= n; j++) d[0][j] = j * costs.ins;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const same = ref[i - 1] === hyp[j - 1];
      d[i][j] = Math.min(
        d[i - 1][j - 1] + (same ? 0 : costs.sub),
        d[i - 1][j] + costs.del,
        d[i][j - 1] + costs.ins,
      );
    }
  }
  const ops: AlignOp[] = [];
  let i = m;
  let j = n;
  let subs = 0, dels = 0, ins = 0, hits = 0;
  const eps = 1e-9;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1] && Math.abs(d[i][j] - d[i - 1][j - 1]) < eps) {
      ops.push({ op: 'ok', ref: ref[i - 1], hyp: hyp[j - 1] });
      hits++; i--; j--;
    } else if (i > 0 && j > 0 && Math.abs(d[i][j] - (d[i - 1][j - 1] + costs.sub)) < eps) {
      ops.push({ op: 'sub', ref: ref[i - 1], hyp: hyp[j - 1] });
      subs++; i--; j--;
    } else if (i > 0 && Math.abs(d[i][j] - (d[i - 1][j] + costs.del)) < eps) {
      ops.push({ op: 'del', ref: ref[i - 1] });
      dels++; i--;
    } else {
      ops.push({ op: 'ins', hyp: hyp[j - 1] });
      ins++; j--;
    }
  }
  ops.reverse();
  return { distance: d[m][n], ops, subs, dels, ins, hits };
}

/** Split into sentences (rough). */
export function sentences(s: string): string[] {
  return canon(s)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
}

/** Share of ASCII letters among letters: a cheap "mostly English" check. */
export function latinRatio(s: string): number {
  const letters = s.match(/\p{L}/gu) ?? [];
  if (!letters.length) return 1;
  const latin = letters.filter((c) => /[a-z]/i.test(c)).length;
  return latin / letters.length;
}

const COMMON_EN = new Set('the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were please thank'.split(' '));

/** Fraction of tokens that are very common English words. */
export function englishRatio(s: string): number {
  const t = tokens(s);
  if (!t.length) return 0;
  return t.filter((w) => COMMON_EN.has(w)).length / t.length;
}

/** Detect looping/repeated text: share of repeated 3-grams. */
export function repetitionRatio(s: string): number {
  const t = tokens(s);
  if (t.length < 9) return 0;
  const grams = new Map<string, number>();
  for (let i = 0; i + 2 < t.length; i++) {
    const g = `${t[i]} ${t[i + 1]} ${t[i + 2]}`;
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  let repeated = 0;
  for (const c of grams.values()) if (c > 1) repeated += c - 1;
  return repeated / Math.max(1, t.length - 2);
}

/** Longest common word sequence ratio (for verbatim-copy detection). */
export function verbatimRatio(source: string, answer: string): number {
  const a = tokens(source);
  const b = tokens(answer);
  if (!a.length || !b.length) return 0;
  let best = 0;
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = tmp;
    }
  }
  return best / a.length;
}

export function lexicalDiversity(s: string): number {
  const t = tokens(s);
  if (!t.length) return 0;
  return new Set(t).size / t.length;
}
