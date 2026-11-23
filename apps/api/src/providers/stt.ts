import fs from 'node:fs';
import path from 'node:path';
import type { Word } from '@fluentpath/shared';
import { config } from '../config.ts';
import { ProviderError, budgetAvailable, budgetUse, fetchWithTimeout, inCooldown, limiter, setCooldown, withRetry } from './util.ts';

export interface Transcription {
  text: string;
  words: Word[];
  noSpeechProb: number | null;
  avgLogprob: number | null;
  source: 'groq';
}

export function sttAvailable(): boolean {
  return !!config.keys.groq;
}

const run = limiter(2);

/**
 * Groq Whisper (OpenAI-compatible transcription endpoint).
 * Spec 21.6 / 22.5: never pass the target sentence as a prompt, temperature 0,
 * keep word timestamps and segment confidence.
 */
export async function transcribe(filePath: string, mimeType: string): Promise<Transcription> {
  if (!config.keys.groq) throw new ProviderError('groq-stt', 'GROQ_API_KEY not set', false);
  if (inCooldown('groq-stt') || !budgetAvailable('groq')) throw new ProviderError('groq-stt', 'rate limited, retry later', true);
  const buf = await fs.promises.readFile(filePath);

  // If audio buffer is too small (< 1200 bytes, e.g. accidental click or missing clusters), treat cleanly as silence
  if (buf.length < 1200) {
    return {
      text: '',
      words: [],
      noSpeechProb: 1.0,
      avgLogprob: -10,
      source: 'groq' as const,
    };
  }

  return run(() =>
    withRetry(async () => {
      const form = new FormData();
      const ext = path.extname(filePath) || '.webm';
      form.append('file', new Blob([buf], { type: mimeType.split(';')[0] || 'audio/webm' }), `answer${ext}`);
      form.append('model', config.models.whisper);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      form.append('timestamp_granularities[]', 'segment');
      form.append('temperature', '0');
      form.append('language', 'en');
      budgetUse('groq');
      const res = await fetchWithTimeout(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        { method: 'POST', headers: { Authorization: `Bearer ${config.keys.groq}` }, body: form },
        45_000,
      );
      if (res.status === 429) {
        setCooldown('groq-stt', 20_000);
        throw new ProviderError('groq-stt', 'rate limited', true, 429);
      }
      if (!res.ok) {
        const errText = await res.text();
        // If Groq rejects the media as invalid/unparseable (e.g. truncated frames from instant stop), treat as silence
        if (res.status === 400 && (errText.includes('invalid_media_file') || errText.includes('could not process file'))) {
          console.warn('[groq-stt] Audio file unparseable by Groq, treating as silence');
          return {
            text: '',
            words: [],
            noSpeechProb: 1.0,
            avgLogprob: -10,
            source: 'groq' as const,
          };
        }
        throw new ProviderError('groq-stt', `HTTP ${res.status}: ${errText.slice(0, 200)}`, res.status >= 500);
      }
      const j = (await res.json()) as any;
      const segments: any[] = Array.isArray(j.segments) ? j.segments : [];
      const words: Word[] = Array.isArray(j.words)
        ? j.words.map((w: any) => ({ word: String(w.word ?? '').trim(), start: Number(w.start) || 0, end: Number(w.end) || 0 }))
        : [];
      const totalDur = segments.reduce((s, x) => s + Math.max(0.01, (x.end ?? 0) - (x.start ?? 0)), 0);
      const weighted = (key: string) =>
        segments.length
          ? segments.reduce((s, x) => s + (Number(x[key]) || 0) * Math.max(0.01, (x.end ?? 0) - (x.start ?? 0)), 0) / (totalDur || 1)
          : null;

      let text = String(j.text ?? '').trim();
      const noSpeechProb = weighted('no_speech_prob');

      // Filter Whisper silence hallucinations (e.g. "Thank you.", "Thank you", "you") on empty/silent audio
      const clean = text.toLowerCase().replace(/[^a-z]/g, '');
      if (
        (clean === 'thankyou' || clean === 'you' || clean === 'thankyouforwatching' || clean === 'thanks') &&
        ((noSpeechProb !== null && noSpeechProb > 0.3) || words.length <= 2)
      ) {
        text = '';
      }

      return {
        text,
        words,
        noSpeechProb,
        avgLogprob: weighted('avg_logprob'),
        source: 'groq' as const,
      };
    }, 2, 1500),
  );
}
