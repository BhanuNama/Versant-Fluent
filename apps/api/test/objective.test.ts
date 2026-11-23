import { describe, expect, it } from 'vitest';
import {
  scoreSentenceCompletion,
  scoreDictation,
  scoreRepeat,
  scoreChoice,
} from '../src/scoring/objective.ts';

describe('Objective Scorer', () => {
  describe('Part A: Sentence Completion', () => {
    const accepted = ['concerned', 'worried', 'anxious'];

    it('gives full credit for accepted words', () => {
      const res = scoreSentenceCompletion('concerned', accepted);
      expect(res.score).toBe(1);
    });

    it('is case-insensitive and trims whitespace', () => {
      const res = scoreSentenceCompletion('  Worried  ', accepted);
      expect(res.score).toBe(1);
    });

    it('gives 0.5 credit for single-character typos', () => {
      const res = scoreSentenceCompletion('concened', accepted); // missing 'r'
      expect(res.score).toBe(0.5);
      expect(res.feedback).toContain('spelled "concened"');
    });

    it('gives 0 credit for wrong words or multi-word inputs', () => {
      expect(scoreSentenceCompletion('happy', accepted).score).toBe(0);
      expect(scoreSentenceCompletion('very concerned', accepted).score).toBe(0);
      expect(scoreSentenceCompletion('', accepted).score).toBe(0);
    });
  });

  describe('Part C & F: Multiple Choice', () => {
    it('scores exact match 1 and mismatch 0', () => {
      expect(scoreChoice(2, 2)).toBe(1);
      expect(scoreChoice(1, 2)).toBe(0);
      expect(scoreChoice(undefined, 2)).toBe(0);
    });
  });

  describe('Part E: Dictation', () => {
    const target = 'Can you send the invoice today?';

    it('gives 1.0 for a perfect match', () => {
      const res = scoreDictation(target, 'Can you send the invoice today?');
      expect(res.score).toBe(1);
      expect(res.feedback).toContain('Perfect dictation');
    });

    it('penalizes missed words proportionally', () => {
      // missed 1 word out of 6
      const res = scoreDictation(target, 'Can you send invoice today?');
      expect(res.score).toBeGreaterThan(0.75);
      expect(res.score).toBeLessThan(0.95);
    });

    it('tolerates small punctuation and casing slips with minor penalty', () => {
      const res = scoreDictation(target, 'can you send the invoice today');
      expect(res.score).toBeGreaterThanOrEqual(0.85);
      expect(res.score).toBeLessThanOrEqual(1.0);
    });

    it('gives 0 for empty submission', () => {
      const res = scoreDictation(target, '');
      expect(res.score).toBe(0);
    });
  });

  describe('Part H: Repeat Sentences', () => {
    const target = 'The lunch break starts at one.';

    it('gives high score when all words are repeated accurately with high fluency', () => {
      const res = scoreRepeat(target, 'The lunch break starts at one', 0.9);
      expect(res.score).toBeGreaterThanOrEqual(0.9);
      expect(res.accuracy).toBe(1);
    });

    it('penalizes omitted words and low fluency', () => {
      const res = scoreRepeat(target, 'The lunch at one', 0.4);
      expect(res.score).toBeLessThan(0.7);
    });
  });
});
