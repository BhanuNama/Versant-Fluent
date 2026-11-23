import path from 'node:path';
import fs from 'node:fs';
import { DEFAULT_SKILL_WEIGHTS } from '@fluentpath/shared';

export const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');

for (const file of ['.env', '.env.local']) {
  const p = path.join(ROOT_DIR, file);
  if (fs.existsSync(p)) {
    try {
      process.loadEnvFile(p);
    } catch {
      /* ignore malformed env file */
    }
  }
}

const env = process.env;
const isProd = env.NODE_ENV === 'production';

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v !== undefined ? n : d;
}

const jwtSecret = env.JWT_SECRET || '';
if (isProd && jwtSecret.length < 24) {
  throw new Error('JWT_SECRET must be set (24+ chars) in production');
}

export const config = {
  isProd,
  port: num(env.PORT, 8787),
  mongoUri: env.MONGODB_URI || '',
  jwtSecret: jwtSecret || 'dev-only-secret-change-me-please-0123456789',
  clientOrigins: (env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  cookie: {
    sameSite: (env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',
    secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
  },
  adminEmails: (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  keys: {
    groq: env.GROQ_API_KEY || '',
    gemini: env.GEMINI_API_KEY || '',
    openrouter: env.OPENROUTER_API_KEY || '',
    azureSpeech: env.AZURE_SPEECH_KEY || '',
    azureRegion: env.AZURE_SPEECH_REGION || '',
  },
  languageToolUrl: (env.LANGUAGETOOL_URL ?? 'https://api.languagetool.org').replace(/\/$/, ''),
  models: {
    groq: env.GROQ_LLM_MODEL || 'llama-3.3-70b-versatile',
    whisper: env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo',
    gemini: env.GEMINI_MODEL || 'gemini-2.0-flash',
    openrouter: env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  },
  budgets: {
    groq: num(env.BUDGET_GROQ, 900),
    gemini: num(env.BUDGET_GEMINI, 1200),
    openrouter: num(env.BUDGET_OPENROUTER, 180),
    languagetool: num(env.BUDGET_LANGUAGETOOL, 1500),
  } as Record<string, number>,
  judgeRuns: Math.max(1, Math.min(3, num(env.JUDGE_RUNS, 2))),
  embeddings: (env.EMBEDDINGS === 'overlap' ? 'overlap' : 'local') as 'local' | 'overlap',
  dataDir: path.resolve(ROOT_DIR, env.DATA_DIR || 'data'),
  contentDir: path.join(ROOT_DIR, 'content'),
  audioRetentionDays: num(env.AUDIO_RETENTION_DAYS, 30),
  sessionTtlHours: 6,
  skillWeights: { ...DEFAULT_SKILL_WEIGHTS },
  /** Launch range policy: never display narrower than +/- this many GSE points. */
  minRangeHalfWidth: num(env.MIN_RANGE_HALF_WIDTH, 6),
  workerConcurrency: num(env.WORKER_CONCURRENCY, 2),
};

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(path.join(config.dataDir, 'uploads'), { recursive: true });
