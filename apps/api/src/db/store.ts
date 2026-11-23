import crypto from 'node:crypto';
import type { UserDoc, ItemDoc, SessionDoc, AnswerDoc, ResultDoc, JobDoc, CacheDoc, CalibrationDoc } from './types.ts';

export type Filter = Record<string, unknown>;
export interface FindOpts { sort?: Record<string, 1 | -1>; limit?: number }

export interface Collection<T extends { _id: string }> {
  insert(doc: T): Promise<T>;
  get(id: string): Promise<T | null>;
  findOne(filter: Filter): Promise<T | null>;
  find(filter: Filter, opts?: FindOpts): Promise<T[]>;
  update(id: string, set: Partial<T>): Promise<T | null>;
  /** Atomically find the first matching document (by sort) and apply `set`. Used for job claiming. */
  claim(filter: Filter, set: Partial<T>, sort?: Record<string, 1 | -1>): Promise<T | null>;
  deleteMany(filter: Filter): Promise<number>;
  count(filter: Filter): Promise<number>;
}

export interface Store {
  kind: 'mongo' | 'file';
  users: Collection<UserDoc>;
  items: Collection<ItemDoc>;
  sessions: Collection<SessionDoc>;
  answers: Collection<AnswerDoc>;
  results: Collection<ResultDoc>;
  jobs: Collection<JobDoc>;
  cache: Collection<CacheDoc>;
  calibration: Collection<CalibrationDoc>;
  close(): Promise<void>;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
