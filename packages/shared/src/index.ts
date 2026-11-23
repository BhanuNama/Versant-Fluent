import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Parts, skills, timing                                               */
/* ------------------------------------------------------------------ */

export const PARTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
export type PartId = (typeof PARTS)[number];

export const SKILLS = ['reading', 'writing', 'listening', 'speaking'] as const;
export type Skill = (typeof SKILLS)[number];

export const SCORING_VERSION = '2026.11.1';
export const DISCLAIMER = 'Practice estimate, not an official score.';
export const PREPARE_SEC = 3;
export const ANSWER_GRACE_MS = 25000;

export interface PartMeta {
  id: PartId;
  name: string;
  skill: Skill;
  task: string;
  instructions: string;
  listening: boolean;
  speaking: boolean;
  /** items per full test (G counts stories, each with several questions) */
  fullCount: number;
  practiceCount: number;
  timeLabel: string;
  /** objective parts enter the Rasch estimate; judged parts get a direct GSE from the judge ensemble */
  scoring: 'objective' | 'judged';
}

export const PART_META: Record<PartId, PartMeta> = {
  A: {
    id: 'A', name: 'Sentence Completion', skill: 'reading', task: 'Type one word',
    instructions: 'Read each sentence and type the one word that best fills the blank. You have 25 seconds per sentence.',
    listening: false, speaking: false, fullCount: 10, practiceCount: 6, timeLabel: '25 s per item', scoring: 'objective',
  },
  B: {
    id: 'B', name: 'Passage Reconstruction', skill: 'writing', task: 'Read 30 s, rewrite 90 s',
    instructions: 'Read the passage for 30 seconds. It will then disappear. Rewrite it in your own words in 90 seconds, keeping all the key ideas.',
    listening: false, speaking: false, fullCount: 3, practiceCount: 2, timeLabel: '120 s per item', scoring: 'judged',
  },
  C: {
    id: 'C', name: 'Reading Comprehension', skill: 'reading', task: 'Read and choose',
    instructions: 'Read the passage and answer the questions. You have 3 minutes per passage.',
    listening: false, speaking: false, fullCount: 3, practiceCount: 2, timeLabel: '3 min per passage', scoring: 'objective',
  },
  D: {
    id: 'D', name: 'Email Writing', skill: 'writing', task: 'Write a 100+ word email',
    instructions: 'Read the situation and write an email of at least 100 words. Cover every point and give a supporting idea for each. You have 9 minutes.',
    listening: false, speaking: false, fullCount: 2, practiceCount: 1, timeLabel: '9 min per email', scoring: 'judged',
  },
  E: {
    id: 'E', name: 'Dictation', skill: 'listening', task: 'Listen once, type',
    instructions: 'You will hear a sentence once. Type exactly what you hear, with correct spelling and punctuation. You have 25 seconds after the audio ends.',
    listening: true, speaking: false, fullCount: 8, practiceCount: 5, timeLabel: '25 s per item', scoring: 'objective',
  },
  F: {
    id: 'F', name: 'Response Selection', skill: 'listening', task: 'Hear, then choose A, B or C',
    instructions: 'Listen to a question or statement, then choose the most appropriate response. You have 8 seconds after the audio ends.',
    listening: true, speaking: false, fullCount: 8, practiceCount: 5, timeLabel: '8 s per item', scoring: 'objective',
  },
  G: {
    id: 'G', name: 'Passage Comprehension', skill: 'listening', task: 'Listen, answer aloud',
    instructions: 'Listen to a short passage once. Then you will hear questions about it. Answer each question aloud in a few words.',
    listening: true, speaking: true, fullCount: 2, practiceCount: 1, timeLabel: '15 s per question', scoring: 'objective',
  },
  H: {
    id: 'H', name: 'Repeat', skill: 'speaking', task: 'Repeat the sentence aloud',
    instructions: 'Listen to each sentence once and repeat it exactly as you heard it. Speak clearly at a natural pace.',
    listening: true, speaking: true, fullCount: 10, practiceCount: 6, timeLabel: '~15 s per item', scoring: 'objective',
  },
  I: {
    id: 'I', name: 'Speaking Situations', skill: 'speaking', task: '10 s think, 60 s speak',
    instructions: 'Read the situation. You have 10 seconds to think, then 60 seconds to respond as if you were really there.',
    listening: false, speaking: true, fullCount: 2, practiceCount: 1, timeLabel: '70 s per item', scoring: 'judged',
  },
  J: {
    id: 'J', name: 'Story Retelling', skill: 'speaking', task: 'Hear a story, retell it',
    instructions: 'Listen to a short story once. Then retell it in your own words in 30 seconds. Include who, what happened, and how it ended.',
    listening: true, speaking: true, fullCount: 3, practiceCount: 2, timeLabel: '30 s per item', scoring: 'judged',
  },
};

/** Response windows in seconds (server enforces these; client timers are display only). */
export const TIMING = {
  A: { responseSec: 25 },
  B: { readSec: 30, writeSec: 90 },
  C: { responseSec: 180 },
  D: { responseSec: 540 },
  E: { responseSec: 25 },
  F: { responseSec: 8 },
  G: { responseSec: 15 },
  H: { responseSec: 15 },
  I: { thinkSec: 10, speakSec: 60 },
  J: { speakSec: 30 },
} as const;

/** Total seconds from item start to item deadline (includes prepare countdowns for speaking). */
export function itemLimitSec(part: PartId): number {
  switch (part) {
    case 'A': return 25;
    case 'B': return 120; // 30s read + 90s write
    case 'C': return 180; // 3 min
    case 'D': return 540; // 9 min
    case 'E': return 35;  // 10s audio + 25s typing
    case 'F': return 20;  // 8s audio + 12s choosing
    case 'G': return 110; // ~30s story audio + 3 questions (~25s each) + buffer
    case 'H': return 30;  // ~8s audio + 3s countdown + 15s speak + buffer
    case 'I': return 80;  // 10s think + 60s speak + buffer
    case 'J': return 75;  // ~30s story audio + 3s countdown + 30s speak + buffer
  }
}

export const SKILL_PARTS: Record<Skill, PartId[]> = {
  reading: ['A', 'C'],
  writing: ['B', 'D'],
  listening: ['E', 'F', 'G'],
  speaking: ['H', 'I', 'J'],
};

export const DEFAULT_SKILL_WEIGHTS: Record<Skill, number> = { reading: 20, writing: 25, listening: 20, speaking: 35 };

export const SKILL_LABEL: Record<Skill, string> = {
  reading: 'Reading', writing: 'Writing', listening: 'Listening', speaking: 'Speaking',
};

/* ------------------------------------------------------------------ */
/* Scale                                                               */
/* ------------------------------------------------------------------ */

export const CEFR_BANDS: { level: string; min: number; max: number }[] = [
  { level: 'Below A1', min: 10, max: 21 },
  { level: 'A1', min: 22, max: 29 },
  { level: 'A2', min: 30, max: 42 },
  { level: 'B1', min: 43, max: 58 },
  { level: 'B2', min: 59, max: 75 },
  { level: 'C1', min: 76, max: 84 },
  { level: 'C2', min: 85, max: 90 },
];

export function clampGse(g: number): number {
  return Math.max(10, Math.min(90, g));
}

export function gseToCefr(gse: number): string {
  const g = Math.round(clampGse(gse));
  return CEFR_BANDS.find((b) => g >= b.min && g <= b.max)?.level ?? 'Below A1';
}

/** Approximate Versant 20–80 equivalent (secondary label only). */
export function gseToVersant(gse: number): number {
  return Math.round(Math.max(20, Math.min(80, 20 + (clampGse(gse) - 10) * 0.75)));
}

export const TARGET_PRESETS: { id: string; label: string; score: number }[] = [
  { id: 'voice', label: 'Voice / customer support role', score: 58 },
  { id: 'nonvoice', label: 'Non-voice / back office role', score: 50 },
  { id: 'it', label: 'IT / engineering role', score: 47 },
  { id: 'client', label: 'Client-facing consulting role', score: 65 },
  { id: 'custom', label: 'Custom target', score: 55 },
];

/* ------------------------------------------------------------------ */
/* API schemas (Zod)                                                   */
/* ------------------------------------------------------------------ */

export const partIdSchema = z.enum(PARTS);

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  name: z.string().trim().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const createSessionSchema = z
  .object({
    mode: z.enum(['full', 'part']),
    part: partIdSchema.optional(),
    level: z.enum(['easy', 'medium', 'hard']).default('medium').optional(),
    questionCount: z.number().int().min(1).max(20).optional(),
  })
  .refine((v) => v.mode === 'full' || !!v.part, { message: 'part is required for practice mode' });

export const startItemSchema = z.object({
  itemId: z.string().min(1).max(64),
  sub: z.number().int().min(0).max(10).nullable().optional(),
});

export const integritySchema = z
  .object({ pasted: z.boolean(), pasteChars: z.number().int().min(0).max(100000) })
  .optional();

export const textAnswerSchema = z.object({
  itemId: z.string().min(1).max(64),
  sub: z.number().int().min(0).max(10).nullable().optional(),
  text: z.string().max(6000).optional(),
  choice: z.number().int().min(-1).max(5).optional(),
  choices: z.array(z.number().int().min(-1).max(5)).max(10).optional(),
  clientElapsedMs: z.number().int().min(0).max(3_600_000).optional(),
  integrity: integritySchema,
});

export const audioAnswerFieldsSchema = z.object({
  itemId: z.string().min(1).max(64),
  sub: z.coerce.number().int().min(0).max(10).optional(),
  mimeType: z.string().max(80),
  durationMs: z.coerce.number().int().min(0).max(90_000),
});

export const wordSchema = z.object({ word: z.string().max(60), start: z.number(), end: z.number() });

export const clientTranscriptSchema = z.object({
  text: z.string().max(4000),
  words: z.array(wordSchema).max(2000).optional(),
});

export const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  targetProfile: z.string().max(40).nullable().optional(),
  targetScore: z.number().int().min(10).max(90).nullable().optional(),
});

export const officialScoreSchema = z.object({
  sessionId: z.string().max(64).optional(),
  scale: z.enum(['gse', 'versant']),
  score: z.number().min(10).max(90),
  testDate: z.string().max(40).optional(),
});

export const generateItemsSchema = z.object({
  part: partIdSchema,
  difficulty: z.number().int().min(1).max(5),
  topic: z.string().max(80),
  count: z.number().int().min(1).max(5).default(1),
});

/* ------------------------------------------------------------------ */
/* Client-safe item shapes                                             */
/* ------------------------------------------------------------------ */

interface BaseItem { id: string; timeLimitSec: number }
export type PublicItem =
  | (BaseItem & { part: 'A'; prompt: string })
  | (BaseItem & { part: 'B'; passage: string; readSec: number; writeSec: number })
  | (BaseItem & { part: 'C'; title: string; passage: string; questions: { q: string; options: string[] }[] })
  | (BaseItem & { part: 'D'; task: string; recipient: string; points: string[]; minWords: number })
  | (BaseItem & { part: 'E' })
  | (BaseItem & { part: 'F'; options: string[] })
  | (BaseItem & { part: 'G'; questionCount: number })
  | (BaseItem & { part: 'H' })
  | (BaseItem & { part: 'I'; situation: string; thinkSec: number; speakSec: number })
  | (BaseItem & { part: 'J'; speakSec: number; story?: string });

export interface Capabilities {
  stt: boolean;
  llm: string[];
  grammar: boolean;
  embeddings: 'local' | 'overlap';
}

export interface SessionState {
  sessionId: string;
  mode: 'full' | 'part';
  level?: 'easy' | 'medium' | 'hard';
  status: 'in_progress' | 'grading' | 'complete' | 'abandoned';
  parts: PartId[];
  partIndex: number;
  part: PartId;
  serverTime: string;
  partDeadline: string;
  items: PublicItem[];
  /** answer keys already submitted: "itemId" or "itemId:sub" */
  answered: string[];
  itemDeadlines: Record<string, string>;
  audioPlayed: string[];
  capabilities: Capabilities;
}

export interface Word { word: string; start: number; end: number }

export interface SpeechMetrics {
  wordCount: number;
  wpm: number;
  articulationWpm: number;
  pauseRatio: number;
  longPauses: number;
  fillers: number;
  fillersPer100: number;
  restarts: number;
  fluency: number;
  pronunciation: number | null;
}

export interface AlignOp { op: 'ok' | 'sub' | 'del' | 'ins'; ref?: string; hyp?: string }

export interface GrammarIssue { offset: number; length: number; message: string; replacements: string[]; category: string }

export interface AnswerReview {
  itemId: string;
  sub: number | null;
  part: PartId;
  prompt: string;
  response: string;
  transcript: string | null;
  hasAudio: boolean;
  answerId: string | null;
  score: number;
  gse: number | null;
  feedback: string;
  tips: string[];
  modelAnswer: string | null;
  alignment: AlignOp[] | null;
  grammar: GrammarIssue[] | null;
  metrics: SpeechMetrics | null;
  dimensions: Record<string, number> | null;
  flags: string[];
  provisional: boolean;
}

export interface PartResult {
  part: PartId;
  name: string;
  skill: Skill;
  score: number;
  earnedMarks?: number;
  totalMarks?: number;
  feedback: string;
  items: AnswerReview[];
}

export interface SkillResult { gse: number; range: [number, number]; cefr: string }

export interface SessionResult {
  status: 'grading' | 'complete';
  sessionId: string;
  mode: 'full' | 'part';
  level?: 'easy' | 'medium' | 'hard';
  createdAt: string;
  marks?: { earned: number; total: number; percentage: number };
  overall: { gse: number; range: [number, number]; cefr: string; versant: number };
  skills: Partial<Record<Skill, SkillResult>>;
  parts: PartResult[];
  scoringVersion: string;
  disclaimer: string;
  provisional: boolean;
  flags: string[];
}

export interface GradingProgress {
  status: 'in_progress' | 'grading' | 'complete' | 'abandoned';
  total: number;
  done: number;
  stage: 'transcribing' | 'grammar' | 'scoring' | 'finalizing' | 'done';
}

export interface HistoryEntry {
  sessionId: string;
  mode: 'full' | 'part';
  level?: 'easy' | 'medium' | 'hard';
  parts: PartId[];
  createdAt: string;
  marks?: { earned: number; total: number; percentage: number };
  gse: number;
  range: [number, number];
  cefr: string;
  skills: Partial<Record<Skill, number>>;
  provisional: boolean;
}

export interface PublicUser {
  id: string;
  email: string | null;
  name: string;
  guest: boolean;
  role: 'user' | 'admin';
  targetProfile: string | null;
  targetScore: number | null;
}

export interface ApiErrorBody { error: { code: string; message: string } }
