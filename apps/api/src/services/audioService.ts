import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.ts';
import { db } from '../db/index.ts';

const AUDIO_DIR = path.join(config.contentDir, 'audio');

export interface SignedAudioUrl {
  url: string;
  expires: number;
}

export function signAudioUrl(sessionId: string, itemId: string, sub?: number | null): SignedAudioUrl {
  const expires = Date.now() + 5 * 60 * 1000; // 5 minute validity
  const subPart = sub !== undefined && sub !== null ? `:${sub}` : '';
  const payload = `${sessionId}|${itemId}${subPart}|${expires}`;
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(payload).digest('hex').slice(0, 32);
  const subQuery = sub !== undefined && sub !== null ? `&sub=${sub}` : '';
  const url = `/api/audio/stream?sessionId=${encodeURIComponent(sessionId)}&itemId=${encodeURIComponent(itemId)}${subQuery}&expires=${expires}&sig=${sig}`;
  return { url, expires };
}

export function verifyAudioSig(sessionId: string, itemId: string, sub: number | null, expires: number, sig: string): boolean {
  if (Date.now() > expires) return false;
  const subPart = sub !== null ? `:${sub}` : '';
  const payload = `${sessionId}|${itemId}${subPart}|${expires}`;
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(payload).digest('hex').slice(0, 32);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Returns audio file path if pre-generated file exists on disk, or null.
 */
export function getPreGeneratedAudio(itemId: string, sub?: number | null): string | null {
  const baseName = sub !== undefined && sub !== null ? `${itemId}_${sub}` : itemId;
  for (const ext of ['.mp3', '.wav', '.ogg']) {
    const p = path.join(AUDIO_DIR, `${baseName}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Clean up old recorded answer audio files older than audioRetentionDays (Spec 13).
 */
export async function cleanupExpiredAudio(): Promise<number> {
  const uploadDir = path.join(config.dataDir, 'uploads');
  if (!fs.existsSync(uploadDir)) return 0;

  const now = Date.now();
  const maxAge = config.audioRetentionDays * 24 * 3600 * 1000;
  let deleted = 0;

  const files = await fs.promises.readdir(uploadDir);
  for (const file of files) {
    const fullPath = path.join(uploadDir, file);
    try {
      const stat = await fs.promises.stat(fullPath);
      if (now - stat.mtimeMs > maxAge) {
        await fs.promises.unlink(fullPath);
        deleted++;
      }
    } catch {
      // skip errors
    }
  }

  return deleted;
}
