import type { PartId, SpeechMetrics, AlignOp, GrammarIssue, Word, Skill } from '@fluentpath/shared';

export interface UserDoc {
  _id: string;
  email: string | null;
  passwordHash: string | null;
  name: string;
  role: 'user' | 'admin';
  guest: boolean;
  targetProfile: string | null;
  targetScore: number | null;
  createdAt: string;
}

export interface ItemDoc {
  _id: string;
  part: PartId;
  gse: number;
  difficulty: number;
  tags: string[];
  status: 'draft' | 'reviewed' | 'live';
  content: any;
  answerKey: any;
  rubric?: any;
  modelAnswer?: string;
  createdAt: string;
}

export interface ItemStart { startedAt: string; deadline: string }

export interface SessionDoc {
  _id: string;
  userId: string;
  mode: 'full' | 'part';
  level?: 'easy' | 'medium' | 'hard';
  parts: PartId[];
  partIndex: number;
  itemIds: Partial<Record<PartId, string[]>>;
  startedAt: string;
  partStartedAt: string;
  partDeadline: string;
  partDeadlines: Partial<Record<PartId, string>>;
  itemStarts: Record<string, ItemStart>;
  audioPlays: Record<string, number>;
  status: 'in_progress' | 'grading' | 'complete' | 'abandoned';
  expiresAt: string;
  submittedAt?: string;
  createdAt: string;
}

export interface RaschObs { b: number; x: number; guess?: number }
export interface DirectObs { gse: number; sd: number; disagreement?: number }

export interface JudgeSummary {
  dims: Record<string, number>;
  gse: number;
  cefr: string;
  comment: string;
  onTopic: boolean;
  grades: number;
  disagreement: number;
  providers: string[];
  flagged: boolean;
}

export interface AnswerDoc {
  _id: string;
  sessionId: string;
  userId: string;
  itemId: string;
  sub: number | null;
  key: string;
  part: PartId;
  raw: {
    text?: string;
    choice?: number;
    choices?: number[];
    audioPath?: string | null;
    mimeType?: string;
    durationMs?: number;
  };
  integrity?: { pasted: boolean; pasteChars: number };
  submittedAt: string;
  timeTakenMs: number;
  transcript: string | null;
  transcriptSource: 'groq' | 'browser' | null;
  words?: Word[];
  noSpeechProb?: number | null;
  avgLogprob?: number | null;
  metrics?: SpeechMetrics | null;
  itemScore: number | null;
  obs?: RaschObs[];
  direct?: DirectObs | null;
  judge?: JudgeSummary | null;
  feedback?: string;
  tips?: string[];
  alignment?: AlignOp[] | null;
  grammar?: GrammarIssue[] | null;
  flags: string[];
  provisional: boolean;
  scoringStatus: 'pending' | 'scored' | 'waiting_transcript';
  scoringVersion: string;
  regradeCount?: number;
}

export interface ResultDoc {
  _id: string;
  sessionId: string;
  userId: string;
  mode: 'full' | 'part';
  level?: 'easy' | 'medium' | 'hard';
  parts: PartId[];
  partScores: Partial<Record<PartId, number>>;
  partMarks?: Partial<Record<PartId, { earned: number; total: number }>>;
  marks?: { earned: number; total: number; percentage: number };
  skillScores: Partial<Record<Skill, { gse: number; sd: number; halfWidth: number; range: [number, number]; cefr: string }>>;
  overall01: number;
  gseEstimate: number;
  gseRange: [number, number];
  cefr: string;
  versant: number;
  provisional: boolean;
  flags: string[];
  scoringVersion: string;
  createdAt: string;
}

export interface JobDoc {
  _id: string;
  answerId: string;
  sessionId: string;
  type: 'score' | 'regrade';
  status: 'queued' | 'running' | 'done' | 'failed';
  stage: 'transcribing' | 'grammar' | 'scoring' | null;
  attempts: number;
  lastError: string | null;
  runAfter: string;
  createdAt: string;
  updatedAt: string;
}

export interface CacheDoc { _id: string; value: any; createdAt: string }

export interface CalibrationDoc {
  _id: string;
  userId: string;
  sessionId: string | null;
  scale: 'gse' | 'versant';
  score: number;
  fluentpathGse: number | null;
  testDate: string | null;
  createdAt: string;
}
