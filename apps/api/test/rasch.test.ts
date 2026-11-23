import { describe, expect, it } from 'vitest';
import { eap, inverseRasch } from '../src/scoring/rasch.ts';

describe('Rasch Ability Estimation', () => {
  it('estimates lower ability for all-incorrect items', () => {
    const items = [
      { b: 40, x: 0 },
      { b: 50, x: 0 },
      { b: 60, x: 0 },
    ];
    const { gse, sd } = eap(items);
    expect(gse).toBeLessThan(35);
    expect(sd).toBeGreaterThan(0);
  });

  it('estimates higher ability for all-correct items', () => {
    const items = [
      { b: 50, x: 1 },
      { b: 60, x: 1 },
      { b: 70, x: 1 },
    ];
    const { gse, sd } = eap(items);
    expect(gse).toBeGreaterThan(65);
    expect(sd).toBeGreaterThan(0);
  });

  it('approximates middle difficulty for 50% success rate on median items', () => {
    const items = [
      { b: 45, x: 1 },
      { b: 55, x: 0 },
    ];
    const { gse } = eap(items);
    expect(gse).toBeGreaterThanOrEqual(44);
    expect(gse).toBeLessThanOrEqual(54);
  });

  it('inverseRasch maps probability correctly around item difficulty', () => {
    expect(Math.round(inverseRasch(50, 0.5))).toBe(50);
    expect(inverseRasch(50, 0.8)).toBeGreaterThan(50);
    expect(inverseRasch(50, 0.2)).toBeLessThan(50);
  });
});
