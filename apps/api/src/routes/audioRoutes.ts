import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import { db } from '../db/index.ts';
import { requireAuth } from '../middleware/auth.ts';
import { getPreGeneratedAudio, signAudioUrl, verifyAudioSig } from '../services/audioService.ts';
import { recordAudioPlay } from '../services/sessionService.ts';

export const audioRouter = Router();

// Sign audio URL for play-once listening task
audioRouter.get('/sign', requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const itemId = req.query.itemId as string;
    const subStr = req.query.sub as string | undefined;
    const sub = subStr !== undefined ? parseInt(subStr, 10) : null;

    if (!sessionId || !itemId) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing sessionId or itemId' } });
    }

    const session = await db().sessions.get(sessionId);
    if (!session || session.userId !== req.user!.uid) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const item = await db().items.get(itemId);
    let promptText = '';
    if (item) {
      if (item.part === 'E') promptText = item.content.text;
      else if (item.part === 'F') promptText = item.content.prompt;
      else if (item.part === 'G') {
        promptText = sub !== null ? (item.content.questions?.[sub]?.q || '') : item.content.story;
      } else if (item.part === 'H') promptText = item.content.text;
      else if (item.part === 'J') promptText = item.content.story;
    }

    const signed = signAudioUrl(sessionId, itemId, sub);
    return res.json({ ...signed, promptText });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Stream audio for listening parts (checks signed URL & enforces play-once)
audioRouter.get('/stream', async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId as string;
    const itemId = req.query.itemId as string;
    const subStr = req.query.sub as string | undefined;
    const sub = subStr !== undefined ? parseInt(subStr, 10) : null;
    const expires = parseInt(req.query.expires as string, 10);
    const sig = req.query.sig as string;

    if (!sessionId || !itemId || !expires || !sig) {
      return res.status(400).send('Bad Request');
    }

    const isValid = verifyAudioSig(sessionId, itemId, sub, expires, sig);
    if (!isValid) {
      return res.status(403).send('Invalid or expired audio signature');
    }

    const session = await db().sessions.get(sessionId);
    if (!session) {
      return res.status(404).send('Session not found');
    }

    // Play-once check: verify and record
    const allowed = await recordAudioPlay(session, itemId, sub);
    if (!allowed) {
      return res.status(403).send('Audio has already been played once for this item.');
    }

    const audioFile = getPreGeneratedAudio(itemId, sub);
    if (audioFile && fs.existsSync(audioFile)) {
      res.setHeader('Content-Type', 'audio/wav');
      return fs.createReadStream(audioFile).pipe(res);
    }

    // Fallback: If no pre-generated audio file exists on disk, we return an instructional 204 or silence
    // In practice client also supports Web Speech API / TTS fallback
    const item = await db().items.get(itemId);
    let promptToSpeak = '';
    if (item) {
      if (item.part === 'E') promptToSpeak = item.content.text;
      else if (item.part === 'F') promptToSpeak = item.content.prompt;
      else if (item.part === 'G') {
        promptToSpeak = sub !== null ? (item.content.questions?.[sub]?.q || '') : item.content.story;
      } else if (item.part === 'H') promptToSpeak = item.content.text;
      else if (item.part === 'J') promptToSpeak = item.content.story;
    }

    res.setHeader('X-Fallback-Prompt', encodeURIComponent(promptToSpeak));
    return res.status(200).json({
      fallbackText: promptToSpeak,
      message: 'Use client synthesis or pre-generated Piper audio',
    });
  } catch (err: any) {
    return res.status(500).send('Internal Server Error');
  }
});

// Stream user's recorded audio for answer review
audioRouter.get('/answer/:answerId', async (req: Request, res: Response) => {
  try {
    const answer = await db().answers.get(String(req.params.answerId));
    if (!answer) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Answer audio not found' } });
    }

    if (!answer.raw.audioPath || !fs.existsSync(answer.raw.audioPath)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Audio file missing or expired' } });
    }

    res.setHeader('Content-Type', answer.raw.mimeType || 'audio/webm');
    return fs.createReadStream(answer.raw.audioPath).pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
