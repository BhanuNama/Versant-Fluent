import {
  DISCLAIMER,
  PART_META,
  type AnswerReview,
  type PartId,
  type PartResult,
  type SessionResult,
  type Skill,
  type SkillResult,
} from '@fluentpath/shared';
import { db } from '../db/index.ts';
import type { AnswerDoc, ItemDoc, ResultDoc, SessionDoc } from '../db/types.ts';

export async function getSessionResultDetails(sessionId: string): Promise<SessionResult | null> {
  const session = await db().sessions.get(sessionId);
  if (!session) return null;

  const resultDoc = await db().results.findOne({ sessionId });
  const answers = await db().answers.find({ sessionId });

  // Collect items
  const allItemIds: string[] = [];
  for (const ids of Object.values(session.itemIds)) {
    if (ids) allItemIds.push(...ids);
  }
  const items = await db().items.find({ _id: { $in: allItemIds } });
  const itemMap = new Map<string, ItemDoc>(items.map((i) => [i._id, i]));

  // If result is not finalized yet, build provisional view or indicate grading
  const isFinal = Boolean(resultDoc);

  // Index submitted answers by key ("itemId" or "itemId:sub")
  const answerByKey = new Map<string, AnswerDoc>();
  for (const ans of answers) {
    answerByKey.set(ans.key, ans);
  }

  const formatPromptAndModel = (it: ItemDoc | undefined, sub: number | null) => {
    let promptText = '';
    if (it) {
      if (it.part === 'A') promptText = it.content.prompt;
      else if (it.part === 'B') promptText = it.content.passage;
      else if (it.part === 'C') promptText = it.content.title ? `${it.content.title}\n\n${it.content.passage}` : it.content.passage;
      else if (it.part === 'D') promptText = it.content.task;
      else if (it.part === 'E') promptText = it.content.text;
      else if (it.part === 'F') promptText = it.content.prompt;
      else if (it.part === 'G') {
        const subQ = sub !== null ? it.content.questions?.[sub]?.q : '';
        promptText = subQ ? `Story: "${it.content.story}"\n\nQuestion ${sub! + 1}: ${subQ}` : it.content.story;
      }
      else if (it.part === 'H') promptText = it.content.text;
      else if (it.part === 'I') promptText = it.content.situation;
      else if (it.part === 'J') promptText = it.content.story;
    }

    let modelAnswer = it?.modelAnswer || null;
    if (!modelAnswer && it) {
      if (it.part === 'A' && it.answerKey?.accepted) {
        modelAnswer = it.answerKey.accepted.join(', ');
      } else if (it.part === 'B') {
        modelAnswer = it.content.passage;
      } else if (it.part === 'C' && it.content?.questions) {
        modelAnswer = it.content.questions
          .map((q: any, i: number) => `Q${i + 1}: ${q.options[q.correct ?? it.answerKey?.answers?.[i] ?? 0]}`)
          .join(' | ');
      } else if (it.part === 'E') {
        modelAnswer = it.content.text;
      } else if (it.part === 'F' && it.content?.options) {
        const corr = it.answerKey?.correct ?? it.answerKey?.answer ?? 0;
        modelAnswer = it.content.options[corr] || null;
      } else if (it.part === 'G' && it.answerKey?.expected) {
        const exp = sub !== null ? it.answerKey.expected[sub] : it.answerKey.expected[0];
        modelAnswer = Array.isArray(exp) ? exp.join(' / ') : String(exp || '');
      } else if (it.part === 'H') {
        modelAnswer = it.content.text;
      } else if (it.part === 'I') {
        modelAnswer = 'Speak clearly, address all elements of the situation directly, and maintain natural flow.';
      } else if (it.part === 'J') {
        modelAnswer = it.content.story;
      }
    }

    return { promptText, modelAnswer };
  };

  const buildReview = (partId: PartId, itemId: string, sub: number | null, ans?: AnswerDoc): AnswerReview => {
    const it = itemMap.get(itemId);
    const { promptText, modelAnswer } = formatPromptAndModel(it, sub);

    if (!ans) {
      return {
        itemId,
        sub,
        part: partId,
        prompt: promptText,
        response: 'No response submitted (Skipped or Time Expired)',
        transcript: null,
        hasAudio: false,
        answerId: null,
        score: 0,
        gse: null,
        feedback: 'No answer was recorded before the item timer ended.',
        tips: [],
        modelAnswer,
        alignment: null,
        grammar: null,
        metrics: null,
        dimensions: null,
        flags: ['unanswered'],
        provisional: false,
      };
    }

    let responseText = ans.raw.text || '';
    if (ans.part === 'C' && ans.raw.choices && it?.content?.questions) {
      const qTexts = it.content.questions.map((q: any, idx: number) => {
        const choiceIdx = ans.raw.choices![idx];
        const chosen = choiceIdx !== undefined && choiceIdx >= 0 ? q.options[choiceIdx] : 'None';
        return `Q${idx + 1}: ${chosen}`;
      });
      responseText = qTexts.join(' | ');
    } else if (ans.part === 'F' && it?.content?.options && ans.raw.choice !== undefined) {
      responseText = it.content.options[ans.raw.choice] || 'None';
    } else if (!responseText && ans.transcript) {
      responseText = ans.transcript;
    }

    return {
      itemId: ans.itemId,
      sub: ans.sub,
      part: ans.part,
      prompt: promptText,
      response: responseText,
      transcript: ans.transcript,
      hasAudio: Boolean(ans.raw.audioPath),
      answerId: ans._id,
      score: ans.itemScore ?? 0,
      gse: ans.direct?.gse ?? null,
      feedback: ans.feedback || 'Evaluated.',
      tips: ans.tips || [],
      modelAnswer,
      alignment: ans.alignment || null,
      grammar: ans.grammar || null,
      metrics: ans.metrics || null,
      dimensions: ans.judge?.dims || null,
      flags: ans.flags || [],
      provisional: ans.provisional,
    };
  };

  // Build AnswerReviews in exact session item order (including missed/timed-out questions)
  const reviewsByPart: Partial<Record<PartId, AnswerReview[]>> = {};
  for (const partId of session.parts) {
    const list: AnswerReview[] = [];
    const assignedIds = session.itemIds[partId] || [];

    for (const itemId of assignedIds) {
      if (partId === 'G') {
        const it = itemMap.get(itemId);
        const qCount = it?.content?.questions?.length || 3;
        for (let sub = 0; sub < qCount; sub++) {
          list.push(buildReview(partId, itemId, sub, answerByKey.get(`${itemId}:${sub}`)));
        }
      } else {
        list.push(buildReview(partId, itemId, null, answerByKey.get(itemId)));
      }
    }

    reviewsByPart[partId] = list;
  }

  // Build PartResults & marks
  let totalEarnedMarks = 0;
  let totalPossibleMarks = 0;

  const parts: PartResult[] = session.parts.map((partId) => {
    const meta = PART_META[partId];
    const pReviews = reviewsByPart[partId] || [];
    const sum = pReviews.reduce((acc, r) => acc + r.score, 0);
    const total = pReviews.length;
    const earned = Math.round(sum * 10) / 10;

    const pScore = resultDoc?.partScores[partId] ?? (total > 0 ? Math.round((sum / total) * 100) : 0);
    const pMarks = resultDoc?.partMarks?.[partId] ?? { earned, total };

    totalEarnedMarks += pMarks.earned;
    totalPossibleMarks += pMarks.total;

    let partFeedback = `Completed Part ${partId} (${meta.name}).`;
    if (pScore >= 80) partFeedback = `Strong performance in ${meta.name}. Accurate and fluent.`;
    else if (pScore >= 60) partFeedback = `Solid performance in ${meta.name}. Review tips to reach the next band.`;
    else if (pScore > 0) partFeedback = `Good practice effort in ${meta.name}. Focus on key target areas.`;

    return {
      part: partId,
      name: meta.name,
      skill: meta.skill,
      score: pScore,
      earnedMarks: pMarks.earned,
      totalMarks: pMarks.total,
      feedback: partFeedback,
      items: pReviews,
    };
  });

  const skills: Partial<Record<Skill, SkillResult>> = {};
  if (resultDoc?.skillScores) {
    for (const [sk, val] of Object.entries(resultDoc.skillScores)) {
      if (val) {
        skills[sk as Skill] = {
          gse: val.gse,
          range: val.range,
          cefr: val.cefr,
        };
      }
    }
  }

  const roundedEarned = Math.round(totalEarnedMarks * 10) / 10;
  const computedMarks = resultDoc?.marks ?? {
    earned: roundedEarned,
    total: totalPossibleMarks,
    percentage: totalPossibleMarks > 0 ? Math.round((totalEarnedMarks / totalPossibleMarks) * 100) : 0,
  };

  return {
    status: isFinal ? 'complete' : 'grading',
    sessionId: session._id,
    mode: session.mode,
    level: resultDoc?.level ?? session.level,
    createdAt: resultDoc?.createdAt || session.createdAt,
    marks: computedMarks,
    overall: {
      gse: resultDoc?.gseEstimate ?? 10,
      range: resultDoc?.gseRange ?? [10, 22],
      cefr: resultDoc?.cefr ?? 'Below A1',
      versant: resultDoc?.versant ?? 20,
    },
    skills,
    parts,
    scoringVersion: resultDoc?.scoringVersion || session.createdAt,
    disclaimer: DISCLAIMER,
    provisional: resultDoc?.provisional ?? false,
    flags: resultDoc?.flags ?? [],
  };
}
