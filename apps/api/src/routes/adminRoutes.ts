import { Router, type Request, type Response } from 'express';
import { generateItemsSchema, partIdSchema } from '@fluentpath/shared';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { newId, nowIso } from '../db/store.ts';
import type { ItemDoc } from '../db/types.ts';
import { requireAdmin } from '../middleware/auth.ts';
import { availableLlms, chatJson } from '../providers/llm.ts';
import { budgetSnapshot } from '../providers/util.ts';
import { sttAvailable } from '../providers/stt.ts';
import { grammarConfigured } from '../providers/grammar.ts';
import { embeddingsMode } from '../providers/embeddings.ts';

export const adminRouter = Router();

// Provider & budget health
adminRouter.get('/health', requireAdmin, async (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    llmProviders: availableLlms(),
    sttAvailable: sttAvailable(),
    grammarConfigured: grammarConfigured(),
    embeddingsMode: embeddingsMode(),
    budgets: budgetSnapshot(),
  });
});

// List items
adminRouter.get('/items', requireAdmin, async (req: Request, res: Response) => {
  const part = req.query.part as string | undefined;
  const status = req.query.status as string | undefined;

  const filter: Record<string, any> = {};
  if (part) filter.part = part;
  if (status) filter.status = status;

  const items = await db().items.find(filter, { sort: { part: 1 } });
  return res.json({ items });
});

// Create item
adminRouter.post('/items', requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const itemDoc: ItemDoc = {
      _id: body.id || newId(body.part?.toLowerCase() || 'item'),
      part: partIdSchema.parse(body.part),
      gse: Number(body.gse) || 50,
      difficulty: Number(body.difficulty) || 3,
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: body.status || 'live',
      content: body.content || {},
      answerKey: body.answerKey || {},
      rubric: body.rubric,
      modelAnswer: body.modelAnswer,
      createdAt: nowIso(),
    };

    await db().items.insert(itemDoc);
    return res.status(201).json({ item: itemDoc });
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
});

// Update item
adminRouter.patch('/items/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await db().items.update(String(req.params.id), req.body);
    if (!updated) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Item not found' } });
    }
    return res.json({ item: updated });
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }
});

// AI Item Generator (spec 12)
adminRouter.post('/items/generate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { part, difficulty, topic, count } = generateItemsSchema.parse(req.body);

    const prompt = `You are an expert English assessment developer. Create ${count} original item(s) for Part ${part} of an English test at difficulty level ${difficulty}/5 (topic: ${topic}).
Do not copy any Pearson or copyrighted items. Ensure natural, contemporary language appropriate for workplace or daily life.

Return a JSON array of items following this structure:
For Part A: [{ "prompt": "Sentence with ____ blank", "accepted": ["word1", "word2"], "modelAnswer": "word1", "gse": 50 }]
For Part B: [{ "passage": "40-60 word story", "keyIdeas": ["idea1", "idea2", "idea3", "idea4"], "modelAnswer": "sample rewrite", "gse": 52 }]
For Part C: [{ "title": "article title", "passage": "120-150 words", "questions": [{ "q": "question", "options": ["A", "B", "C", "D"] }], "answers": [0, 1], "gse": 55 }]
For Part D: [{ "task": "situation prompt", "recipient": "Manager", "points": ["theme1", "theme2", "theme3"], "minWords": 100, "gse": 58 }]
For Part E or H: [{ "text": "Clear 6-12 word natural spoken sentence.", "gse": 48 }]
For Part F: [{ "prompt": "Spoken question or statement", "options": ["A", "B", "C"], "answer": 0, "gse": 45 }]
For Part G: [{ "story": "Short 30-word story", "questions": [{"q": "q1"}, {"q": "q2"}, {"q": "q3"}], "expected": [["ans1"], ["ans2"], ["ans3"]], "gse": 50 }]
For Part I: [{ "situation": "Workplace speaking challenge prompt", "expectations": ["point1", "point2"], "modelAnswer": "spoken response", "gse": 55 }]
For Part J: [{ "story": "Short 50-word narrative", "elements": ["event1", "event2", "event3", "event4"], "modelAnswer": "retell", "gse": 52 }]

Return only JSON:
{"items": [...]}`;

    const { value, provider } = await chatJson<{ items: any[] }>(
      [
        { role: 'system', content: 'You are an assessment item author. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      (raw: any) => {
        if (!Array.isArray(raw?.items)) throw new Error('Expected items array');
        return raw;
      }
    );

    return res.json({ items: value.items, provider });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'GENERATION_FAILED', message: err.message } });
  }
});
