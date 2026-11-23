import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import {
  audioAnswerFieldsSchema,
  createSessionSchema,
  startItemSchema,
  textAnswerSchema,
} from '@fluentpath/shared';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { requireAuth } from '../middleware/auth.ts';
import { submitAudioAnswer, submitTextAnswer } from '../services/answerService.ts';
import { addSseSubscriber, checkFinalizeSession, kickWorker } from '../services/jobWorker.ts';
import { getSessionResultDetails } from '../services/resultService.ts';
import { advancePart, createSession, getSessionState, startItemTimer } from '../services/sessionService.ts';

const upload = multer({
  dest: path.join(config.dataDir, 'uploads'),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (spec 7)
  },
});

export const sessionRouter = Router();

// Create session
sessionRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = createSessionSchema.parse(req.body);
    const session = await createSession(req.user!.uid, body.mode, body.part, body.level || 'medium');
    const state = await getSessionState(session._id);
    return res.json(state);
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
});

// Get session state
sessionRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await db().sessions.get(String(req.params.id));
    if (!session || session.userId !== req.user!.uid) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const state = await getSessionState(session._id);
    return res.json(state);
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Start item countdown timer (server records start time)
sessionRouter.post('/:id/timer', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await db().sessions.get(String(req.params.id));
    if (!session || session.userId !== req.user!.uid) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    const body = startItemSchema.parse(req.body);
    const result = await startItemTimer(session, body.itemId, body.sub ?? null);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
});

// Submit answer (JSON text answer OR multipart audio answer)
sessionRouter.post(
  '/:id/answers',
  requireAuth,
  upload.single('audio'),
  async (req: Request, res: Response) => {
    try {
      const session = await db().sessions.get(String(req.params.id));
      if (!session || session.userId !== req.user!.uid) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
      }

      if (session.status !== 'in_progress') {
        return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'Session is not in progress' } });
      }

      // Check if audio file was uploaded
      if (req.file) {
        const fields = audioAnswerFieldsSchema.parse(req.body);
        const result = await submitAudioAnswer({
          session,
          itemId: fields.itemId,
          sub: fields.sub ?? null,
          audioPath: req.file.path,
          mimeType: fields.mimeType || req.file.mimetype || 'audio/webm',
          durationMs: fields.durationMs,
        });
        return res.status(202).json(result);
      } else {
        const body = textAnswerSchema.parse(req.body);
        const result = await submitTextAnswer({
          session,
          itemId: body.itemId,
          sub: body.sub ?? null,
          text: body.text,
          choice: body.choice,
          choices: body.choices,
          clientElapsedMs: body.clientElapsedMs,
          integrity: body.integrity,
        });
        return res.json(result);
      }
    } catch (err: any) {
      const code = err.message.startsWith('DEADLINE_EXCEEDED') ? 'DEADLINE_EXCEEDED' : 'BAD_REQUEST';
      const status = code === 'DEADLINE_EXCEEDED' ? 403 : 400;
      return res.status(status).json({ error: { code, message: err.message } });
    }
  }
);

// Advance to next part
sessionRouter.post('/:id/advance', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await db().sessions.get(String(req.params.id));
    if (!session || session.userId !== req.user!.uid) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const updated = await advancePart(session);
    if (updated.status === 'grading') {
      kickWorker();
    }
    const state = await getSessionState(session._id);
    return res.json(state);
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
});

// Final submit (finishes test and triggers background grading)
sessionRouter.post('/:id/submit', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await db().sessions.get(String(req.params.id));
    if (!session || session.userId !== req.user!.uid) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    await db().sessions.update(session._id, {
      status: 'grading',
      submittedAt: new Date().toISOString(),
    });

    kickWorker();
    return res.json({ status: 'grading' });
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
});

// Server-sent events for grading progress
sessionRouter.get('/:id/events', requireAuth, async (req: Request, res: Response) => {
  const session = await db().sessions.get(String(req.params.id));
  if (!session || session.userId !== req.user!.uid) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial event
  const answers = await db().answers.find({ sessionId: session._id });
  const done = answers.filter((a) => a.scoringStatus === 'scored').length;
  res.write(`data: ${JSON.stringify({ status: session.status, total: answers.length, done, stage: 'transcribing' })}\n\n`);

  addSseSubscriber(session._id, res);

  // If already done, finalize check
  if (session.status === 'complete') {
    res.write(`data: ${JSON.stringify({ status: 'complete', total: answers.length, done: answers.length, stage: 'done' })}\n\n`);
  } else {
    kickWorker();
  }
});

// Full result with feedback & details
sessionRouter.get('/:id/result', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = await db().sessions.get(String(req.params.id));
    if (!session || session.userId !== req.user!.uid) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    // Try finalizing in case background worker is done
    await checkFinalizeSession(session._id);

    const details = await getSessionResultDetails(session._id);
    if (!details) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Result not ready' } });
    }

    return res.json(details);
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
