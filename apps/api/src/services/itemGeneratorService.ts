import { PARTS, type PartId } from '@fluentpath/shared';
import { newId, nowIso } from '../db/store.ts';
import type { ItemDoc } from '../db/types.ts';
import { chatJson } from '../providers/llm.ts';

const TOPICS = [
  'international business and client relations',
  'office teamwork and project deadlines',
  'travel, airport, and hotel accommodations',
  'technology in the workplace and digital tools',
  'customer service, feedback, and refunds',
  'health, wellness, and work-life balance',
  'environmental sustainability in modern offices',
  'event planning, conferences, and logistics',
  'finance, budgeting, and resource allocation',
  'mentorship, training, and professional growth',
];

export async function generatePartItems(
  part: PartId,
  count = 3,
  level: 'easy' | 'medium' | 'hard' = 'medium',
  customTopic?: string
): Promise<ItemDoc[]> {
  const topic = customTopic || TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const gseTarget = level === 'easy' ? 42 : level === 'hard' ? 70 : 54;
  const diffTarget = level === 'easy' ? 2 : level === 'hard' ? 4 : 3;

  const difficultyDesc =
    level === 'easy'
      ? 'Foundational English (A2-B1, simple vocabulary, short sentences, everyday situations)'
      : level === 'hard'
      ? 'Advanced English (B2-C1, sophisticated business vocabulary, complex clauses, nuanced corporate scenarios)'
      : 'Standard English (B1-B2, natural modern workplace or professional conversational English)';

  const prompt = `You are a Pearson Versant assessment author. Create ${count} brand-new, original items for Part ${part} of an English proficiency exam.
Target Level: ${level.toUpperCase()} - ${difficultyDesc}.
Target GSE: around ${gseTarget}.
Theme: ${topic}.

CRITICAL:
1. Do not copy or infringe on any copyrighted tests.
2. Ensure realistic, contemporary, and grammatically impeccable English.
3. Output strictly valid JSON conforming to the requested schema.

Schema specification for Part ${part}:
${
  part === 'A'
    ? `For Part A (Sentence Completion): Return an array of items where each has:
- "prompt": A sentence with a blank indicated as "_____", missing exactly one common or contextual word.
- "accepted": Array of acceptable single-word strings for the blank.
- "modelAnswer": The most natural single word.
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
    : part === 'B'
    ? `For Part B (Passage Reconstruction): Return an array of items where each has:
- "passage": A cohesive narrative paragraph of 40 to 60 words describing a situation or event.
- "keyIdeas": Array of 4-5 concise bullet strings representing the core factual points.
- "modelAnswer": A well-written 40-60 word reconstruction covering all key points.
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
    : part === 'C'
    ? `For Part C (Reading Comprehension): Return an array of items where each has:
- "title": A short article title (3-6 words).
- "passage": A concise 110-140 word informative passage with clear details.
- "questions": Array of exactly 2 multiple-choice questions. Each question has:
    "q": question string
    "options": array of exactly 4 strings
    "correct": integer index (0, 1, 2, or 3) of the correct option
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
    : part === 'D'
    ? `For Part D (Email Writing): Return an array of items where each has:
- "task": A realistic workplace scenario where candidate must write an email.
- "recipient": Name and role of recipient (e.g. "Ms. Elena Rostova, Project Director").
- "points": Array of exactly 3 specific bullet prompts the writer must address.
- "minWords": 100
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
    : part === 'E'
    ? `For Part E (Dictation): Return an array of items where each has:
- "text": A single natural spoken sentence (6 to 12 words) with standard punctuation and capitalization.
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
    : part === 'F'
    ? `For Part F (Response Selection): Return an array of items where each has:
- "prompt": A spoken conversational statement or question (e.g. "Would you like me to reserve the conference room for 2 PM?").
- "options": Array of exactly 3 plausible responses (only one is contextually and pragmatically appropriate).
- "correct": Integer index (0, 1, or 2) of the correct response.
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
    : part === 'G'
    ? `For Part G (Passage Comprehension): Return an array of items where each has:
- "story": A short spoken narrative paragraph of 30 to 45 words containing clear facts (names, actions, causes, numbers).
- "questions": Array of exactly 3 factual questions testing understanding of the story: [{"q": "..."}, {"q": "..."}, {"q": "..."}].
- "expected": Array of 3 arrays of accepted short spoken answers: [["ans1", "alt1"], ["ans2", "alt2"], ["ans3", "alt3"]].
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
    : part === 'H'
    ? `For Part H (Repeat Sentence): Return an array of items where each has:
- "text": A natural, authentic spoken sentence of 7 to 14 words.
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
    : part === 'I'
    ? `For Part I (Speaking Situations): Return an array of items where each has:
- "situation": A workplace or interpersonal dilemma prompt instructing candidate how to respond (e.g. "You promised to send a report by 3 PM, but the client data was delayed. Call your manager to explain the issue, apologize, and propose an updated delivery time.").
- "expectations": Array of 2-3 key things a high-scoring response should include.
- "modelAnswer": A sample 40-60 word spoken response.
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
    : `For Part J (Story Retelling): Return an array of items where each has:
- "story": A short spoken narrative of 40 to 50 words with clear characters, problem/conflict, action taken, and outcome.
- "elements": Array of 4 chronological key story elements or events.
- "modelAnswer": A cohesive spoken retell of the story (40-50 words).
- "gse": Number (${gseTarget - 4} to ${gseTarget + 4})
- "difficulty": ${diffTarget}`
}

Output format:
{
  "items": [...]
}`;

  const { value } = await chatJson<{ items: any[] }>(
    [
      {
        role: 'system',
        content:
          'You are a senior assessment test author for English language proficiency. You generate high-quality items in JSON strictly adhering to the schema.',
      },
      { role: 'user', content: prompt },
    ],
    (raw: any) => {
      if (!Array.isArray(raw?.items) || raw.items.length === 0) {
        throw new Error('Expected non-empty items array');
      }
      return raw;
    },
    0.7
  );

  const docs: ItemDoc[] = [];

  for (const raw of value.items) {
    const id = newId(`ai_${part.toLowerCase()}`);
    let content: any = {};
    let answerKey: any = {};
    let rubric: any = undefined;
    let modelAnswer: string | undefined = raw.modelAnswer;

    if (part === 'A') {
      content = { prompt: raw.prompt };
      answerKey = { accepted: raw.accepted || (raw.modelAnswer ? [raw.modelAnswer] : []) };
    } else if (part === 'B') {
      content = { passage: raw.passage };
      answerKey = { keyIdeas: raw.keyIdeas || [] };
    } else if (part === 'C') {
      content = {
        title: raw.title || 'Workplace Report',
        passage: raw.passage,
        questions: (raw.questions || []).map((q: any) => ({
          q: q.q,
          options: q.options || [],
        })),
      };
      answerKey = {
        answers: (raw.questions || []).map((q: any) => q.correct ?? 0),
        questionGse: [raw.gse || gseTarget, (raw.gse || gseTarget) + 3],
      };
    } else if (part === 'D') {
      content = {
        task: raw.task,
        recipient: raw.recipient || 'Team Leader',
        points: raw.points || [],
        minWords: raw.minWords || 100,
      };
      answerKey = {
        themes: (raw.points || []).map((p: string) => ({
          name: p.toLowerCase(),
          keywords: p.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
        })),
      };
    } else if (part === 'E' || part === 'H') {
      content = { text: raw.text };
      modelAnswer = raw.text;
    } else if (part === 'F') {
      content = { prompt: raw.prompt, options: raw.options || [] };
      const correctIdx = raw.correct ?? 0;
      answerKey = { answer: correctIdx, correct: correctIdx };
    } else if (part === 'G') {
      content = {
        story: raw.story,
        questions: (raw.questions || []).map((q: any) => (typeof q === 'string' ? { q } : q)),
      };
      answerKey = {
        expected: raw.expected || raw.questions?.map(() => ['sample answer']) || [],
        questionGse: [gseTarget - 3, gseTarget, gseTarget + 3],
      };
    } else if (part === 'I') {
      content = { situation: raw.situation };
      rubric = { expectations: raw.expectations || [] };
    } else if (part === 'J') {
      content = { story: raw.story };
      answerKey = { elements: raw.elements || [] };
    }

    const doc: ItemDoc = {
      _id: id,
      part,
      gse: raw.gse || gseTarget,
      difficulty: raw.difficulty || diffTarget,
      tags: [topic, 'ai-generated', level],
      status: 'live',
      content,
      answerKey,
      rubric,
      modelAnswer,
      createdAt: nowIso(),
    };

    docs.push(doc);
  }

  return docs;
}
