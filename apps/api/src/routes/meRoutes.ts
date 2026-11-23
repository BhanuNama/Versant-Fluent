import { Router, type Request, type Response } from 'express';
import { officialScoreSchema, updateMeSchema, type HistoryEntry, type Skill } from '@fluentpath/shared';
import { db } from '../db/index.ts';
import { newId, nowIso } from '../db/store.ts';
import { requireAuth } from '../middleware/auth.ts';
import { toPublicUser } from '../services/authService.ts';

export const meRouter = Router();

// Test history
meRouter.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const results = await db().results.find({ userId }, { sort: { createdAt: -1 }, limit: 50 });

    const history: HistoryEntry[] = results.map((r) => {
      const skills: Partial<Record<Skill, number>> = {};
      if (r.skillScores) {
        for (const [sk, val] of Object.entries(r.skillScores)) {
          if (val) skills[sk as Skill] = val.gse;
        }
      }

      return {
        sessionId: r.sessionId,
        mode: r.mode,
        parts: r.parts,
        createdAt: r.createdAt,
        gse: r.gseEstimate,
        range: r.gseRange,
        cefr: r.cefr,
        skills,
        provisional: r.provisional,
      };
    });

    return res.json({ history });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Progress metrics & cutoff gap
meRouter.get('/progress', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const user = await db().users.get(userId);
    const results = await db().results.find({ userId }, { sort: { createdAt: 1 } });

    const totalTests = results.length;
    const latest = results[results.length - 1];
    const targetScore = user?.targetScore || 58;

    const currentGse = latest ? latest.gseEstimate : null;
    const gap = currentGse !== null ? currentGse - targetScore : null;

    // Skill averages
    const skillSums: Record<Skill, number> = { reading: 0, writing: 0, listening: 0, speaking: 0 };
    const skillCounts: Record<Skill, number> = { reading: 0, writing: 0, listening: 0, speaking: 0 };

    for (const r of results) {
      if (r.skillScores) {
        for (const [sk, v] of Object.entries(r.skillScores)) {
          if (v) {
            skillSums[sk as Skill] += v.gse;
            skillCounts[sk as Skill]++;
          }
        }
      }
    }

    const skillAverages: Partial<Record<Skill, number>> = {};
    for (const sk of ['reading', 'writing', 'listening', 'speaking'] as Skill[]) {
      if (skillCounts[sk] > 0) {
        skillAverages[sk] = Math.round(skillSums[sk] / skillCounts[sk]);
      }
    }

    const timeline = results.map((r) => ({
      date: r.createdAt.slice(0, 10),
      gse: r.gseEstimate,
      reading: r.skillScores?.reading?.gse ?? null,
      writing: r.skillScores?.writing?.gse ?? null,
      listening: r.skillScores?.listening?.gse ?? null,
      speaking: r.skillScores?.speaking?.gse ?? null,
    }));

    return res.json({
      totalTests,
      currentGse,
      targetScore,
      targetProfile: user?.targetProfile || 'voice',
      gap,
      skillAverages,
      timeline,
    });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Update profile / target score
meRouter.patch('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = updateMeSchema.parse(req.body);
    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.targetProfile !== undefined) patch.targetProfile = data.targetProfile;
    if (data.targetScore !== undefined) patch.targetScore = data.targetScore;

    const updated = await db().users.update(req.user!.uid, patch);
    if (!updated) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    return res.json({ user: toPublicUser(updated) });
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
});

// Submit official test score for calibration
meRouter.post('/official', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = officialScoreSchema.parse(req.body);
    let fluentpathGse: number | null = null;
    if (data.sessionId) {
      const resDoc = await db().results.findOne({ sessionId: data.sessionId });
      if (resDoc) fluentpathGse = resDoc.gseEstimate;
    }

    const doc = {
      _id: newId('cal'),
      userId: req.user!.uid,
      sessionId: data.sessionId || null,
      scale: data.scale,
      score: data.score,
      fluentpathGse,
      testDate: data.testDate || null,
      createdAt: nowIso(),
    };

    await db().calibration.insert(doc);
    return res.json({ success: true, message: 'Official score submitted for calibration. Thank you!' });
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
});

// Data deletion (Privacy / GDPR / user control, Spec 13)
meRouter.delete('/data', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const user = await db().users.get(userId);

    // Delete answers, sessions, results, calibration
    await db().answers.deleteMany({ userId });
    await db().sessions.deleteMany({ userId });
    await db().results.deleteMany({ userId });
    await db().calibration.deleteMany({ userId });

    if (user?.guest) {
      await db().users.deleteMany({ _id: userId });
    }

    return res.json({ success: true, message: 'All practice data and answers have been securely deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
