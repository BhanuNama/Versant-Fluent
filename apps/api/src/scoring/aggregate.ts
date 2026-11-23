import {
  CEFR_BANDS,
  DEFAULT_SKILL_WEIGHTS,
  SCORING_VERSION,
  SKILL_PARTS,
  clampGse,
  gseToCefr,
  gseToVersant,
  type PartId,
  type Skill,
} from '@fluentpath/shared';
import { config } from '../config.ts';
import type { AnswerDoc, DirectObs, ItemDoc, RaschObs, ResultDoc, SessionDoc } from '../db/types.ts';
import { eap } from './rasch.ts';

export interface AggregateOutput {
  result: Omit<ResultDoc, '_id' | 'createdAt'>;
  partScores: Partial<Record<PartId, number>>;
}

/**
 * Aggregates answers into part scores, skill estimates, and overall GSE score.
 * Follows Section 8.5, 8.6, 21.8, and 22.1-22.3 of the specification.
 */
export function aggregateSession(
  session: SessionDoc,
  items: ItemDoc[],
  answers: AnswerDoc[]
): AggregateOutput {
  const itemMap = new Map(items.map((it) => [it._id, it]));
  const answersByPart: Partial<Record<PartId, AnswerDoc[]>> = {};

  for (const part of session.parts) {
    answersByPart[part] = [];
  }

  for (const ans of answers) {
    if (answersByPart[ans.part]) {
      answersByPart[ans.part]!.push(ans);
    }
  }

  // 1. Part scores (0..100) & marks across all assigned items in each part
  const partScores: Partial<Record<PartId, number>> = {};
  const partMarks: Partial<Record<PartId, { earned: number; total: number }>> = {};
  let totalEarnedMarks = 0;
  let totalPossibleMarks = 0;

  for (const part of session.parts) {
    const partAns = answersByPart[part] || [];
    const assignedIds = session.itemIds[part] || [];
    let expectedTotal = 0;
    for (const id of assignedIds) {
      if (part === 'G') {
        const it = itemMap.get(id);
        expectedTotal += it?.content?.questions?.length || 3;
      } else {
        expectedTotal += 1;
      }
    }
    const denom = Math.max(expectedTotal, partAns.length);
    const sum = partAns.reduce((acc, a) => acc + (a.itemScore ?? 0), 0);
    const earned = Math.round(sum * 10) / 10;

    partMarks[part] = { earned, total: denom };
    partScores[part] = denom > 0 ? Math.round((sum / denom) * 100) : 0;
    totalEarnedMarks += sum;
    totalPossibleMarks += denom;
  }

  const roundedEarned = Math.round(totalEarnedMarks * 10) / 10;
  const marks = {
    earned: roundedEarned,
    total: totalPossibleMarks,
    percentage: totalPossibleMarks > 0 ? Math.round((totalEarnedMarks / totalPossibleMarks) * 100) : 0,
  };

  // 2. Skill ability estimates
  const skillScores: ResultDoc['skillScores'] = {};
  const activeSkills = new Set<Skill>();

  for (const [skill, parts] of Object.entries(SKILL_PARTS) as [Skill, PartId[]][]) {
    const hasPart = parts.some((p) => session.parts.includes(p));
    if (!hasPart) continue;

    activeSkills.add(skill);

    const raschObs: RaschObs[] = [];
    const directObs: DirectObs[] = [];

    for (const p of parts) {
      const partAns = answersByPart[p] || [];
      for (const ans of partAns) {
        if (ans.obs && ans.obs.length > 0) {
          raschObs.push(...ans.obs);
        }
        if (ans.direct) {
          directObs.push(ans.direct);
        }
      }
    }

    // Estimate ability via EAP
    const { gse, sd } = eap(raschObs, directObs);
    const clampedGse = clampGse(Math.round(gse));

    // Calculate displayed range half-width
    // Spec 22.3: half-width = clamp(1.28 * SD, 3, 10).
    // For judged skills, add average judge disagreement in quadrature
    let halfWidth = Math.max(3, Math.min(10, 1.28 * sd));

    const judgedDisagreements = directObs
      .map((d) => d.disagreement)
      .filter((d): d is number => typeof d === 'number' && d > 0);

    if (judgedDisagreements.length > 0) {
      const avgDis = judgedDisagreements.reduce((a, b) => a + b, 0) / judgedDisagreements.length;
      halfWidth = Math.sqrt(halfWidth * halfWidth + (avgDis * 0.5) ** 2);
    }

    halfWidth = Math.max(config.minRangeHalfWidth, Math.round(halfWidth));

    const minRange = clampGse(clampedGse - halfWidth);
    const maxRange = clampGse(clampedGse + halfWidth);

    skillScores[skill] = {
      gse: clampedGse,
      sd: Math.round(sd * 10) / 10,
      halfWidth,
      range: [minRange, maxRange],
      cefr: gseToCefr(clampedGse),
    };
  }

  // 3. Overall composite calculation
  // Weighted mean of active skills
  let totalWeight = 0;
  let weightedGseSum = 0;
  let weightedHalfWidthSum = 0;

  for (const skill of activeSkills) {
    const w = config.skillWeights[skill] || DEFAULT_SKILL_WEIGHTS[skill] || 25;
    const sResult = skillScores[skill];
    if (sResult) {
      totalWeight += w;
      weightedGseSum += sResult.gse * w;
      weightedHalfWidthSum += sResult.halfWidth * w;
    }
  }

  const overallGse = totalWeight > 0 ? clampGse(Math.round(weightedGseSum / totalWeight)) : 10;
  const overallHalfWidth = totalWeight > 0
    ? Math.max(config.minRangeHalfWidth, Math.round(weightedHalfWidthSum / totalWeight))
    : config.minRangeHalfWidth;

  const overallRange: [number, number] = [
    clampGse(overallGse - overallHalfWidth),
    clampGse(overallGse + overallHalfWidth),
  ];

  // Flags & provisional indicator
  const flags = new Set<string>();
  let hasProvisional = false;

  for (const ans of answers) {
    if (ans.provisional) hasProvisional = true;
    for (const f of ans.flags) flags.add(f);
  }

  const overall01 = (overallGse - 10) / 80;

  const result: Omit<ResultDoc, '_id' | 'createdAt'> = {
    sessionId: session._id,
    userId: session.userId,
    mode: session.mode,
    level: session.level,
    parts: session.parts,
    partScores,
    partMarks,
    marks,
    skillScores,
    overall01: Math.round(overall01 * 1000) / 1000,
    gseEstimate: overallGse,
    gseRange: overallRange,
    cefr: gseToCefr(overallGse),
    versant: gseToVersant(overallGse),
    provisional: hasProvisional,
    flags: Array.from(flags),
    scoringVersion: SCORING_VERSION,
  };

  return { result, partScores };
}
