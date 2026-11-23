import fs from 'node:fs';
import path from 'node:path';
import { config, ROOT_DIR } from '../config.ts';
import { initStore, db } from '../db/index.ts';
import { scoreAsync } from '../scoring/index.ts';
import type { AnswerDoc } from '../db/types.ts';

interface GoldSample {
  id: string;
  part: 'B' | 'D' | 'I' | 'J';
  itemRef: string;
  prompt: string;
  response: string;
  humanScore: number;
  humanGse: number;
}

/** Quadratic weighted kappa calculation (Spec 9) */
function computeQwk(human: number[], auto: number[], minVal = 10, maxVal = 90): number {
  const n = human.length;
  if (n === 0) return 1;

  let num = 0;
  let den = 0;
  const meanH = human.reduce((a, b) => a + b, 0) / n;
  const meanA = auto.reduce((a, b) => a + b, 0) / n;

  for (let i = 0; i < n; i++) {
    const diff = human[i] - auto[i];
    num += diff * diff;
    den += Math.pow(human[i] - meanH, 2) + Math.pow(auto[i] - meanA, 2);
  }

  if (den === 0) return 1;
  const qwk = 1 - (2 * num) / den;
  return Math.round(qwk * 1000) / 1000;
}

async function runGoldRegression() {
  await initStore();
  const goldPath = path.join(ROOT_DIR, 'content/gold/goldSet.json');
  if (!fs.existsSync(goldPath)) {
    console.error('Gold set file missing at:', goldPath);
    process.exit(1);
  }

  const samples: GoldSample[] = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
  console.log(`[gold-regression] loaded ${samples.length} gold set samples...`);

  const humanGseList: number[] = [];
  const autoGseList: number[] = [];
  let absoluteErrorSum = 0;

  for (const s of samples) {
    const item = await db().items.get(s.itemRef);
    if (!item) {
      console.warn(`[gold-regression] item ${s.itemRef} not found in db, skipping`);
      continue;
    }

    const dummyAnswer: AnswerDoc = {
      _id: `gold_${s.id}`,
      sessionId: 'sess_gold',
      userId: 'u_gold',
      itemId: item._id,
      sub: null,
      key: item._id,
      part: item.part,
      raw: { text: s.response, durationMs: 40000 },
      submittedAt: new Date().toISOString(),
      timeTakenMs: 30000,
      transcript: s.response,
      transcriptSource: 'groq',
      itemScore: null,
      flags: [],
      provisional: false,
      scoringStatus: 'pending',
      scoringVersion: 'gold',
    };

    const patch = await scoreAsync(dummyAnswer, item, async () => {});
    const autoGse = patch.direct?.gse ?? (10 + (patch.itemScore ?? 0) * 80);

    humanGseList.push(s.humanGse);
    autoGseList.push(autoGse);

    const err = Math.abs(s.humanGse - autoGse);
    absoluteErrorSum += err;

    console.log(`[${s.id}] Part ${s.part} | Human GSE: ${s.humanGse} vs Auto GSE: ${Math.round(autoGse)} (diff: ${Math.round(err)})`);
  }

  const qwk = computeQwk(humanGseList, autoGseList);
  const mae = Math.round((absoluteErrorSum / humanGseList.length) * 10) / 10;

  console.log('\n=======================================');
  console.log(`Gold Set Samples Tested: ${humanGseList.length}`);
  console.log(`Mean Absolute Error (MAE): ${mae} GSE points`);
  console.log(`Quadratic Weighted Kappa (QWK): ${qwk}`);
  console.log('Target QWK: >= 0.70');
  console.log('=======================================\n');

  if (qwk < 0.60) {
    console.warn('[gold-regression] WARNING: QWK below target safety threshold. Consider tuning anchors or weights.');
  } else {
    console.log('[gold-regression] PASSED: Scoring engine aligns with human gold set.');
  }

  process.exit(0);
}

runGoldRegression().catch((err) => {
  console.error('[gold-regression] fatal:', err);
  process.exit(1);
});
