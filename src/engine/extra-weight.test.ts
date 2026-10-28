import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { addKg, canonicalExtra, isTypingExtra, isValidExtra, kgText, parseExtra, sumKg, trackExtras } from './extra-weight';

describe('an additional weight typed for a pickup', () => {
  it('reads blank as none and a plain number as kilograms', () => {
    expect(parseExtra('')).toBeNull();
    expect(parseExtra('  ')).toBeNull();
    expect(parseExtra('12')).toBe(12);
    expect(parseExtra('12.5')).toBe(12.5);
    expect(parseExtra('0.25')).toBe(0.25);
    expect(parseExtra('.5')).toBe(0.5);
    expect(parseExtra('12.')).toBe(12);
    expect(parseExtra('.')).toBeNull();
  });

  it('refuses text that is not a weight: letters, a sign, a third decimal, more than the maximum', () => {
    for (const bad of ['a', '-1', '+1', '1e3', '1,5', '1.234', '100000.01', '1000000', '1 2']) expect(isValidExtra(bad), bad).toBe(false);
    for (const good of ['', '0', '100000', '99999.99', '0.5', '7.25']) expect(isValidExtra(good), good).toBe(true);
    expect(parseExtra('1.234')).toBeNull();
  });

  it('lets a person type only digits, then a point, then two decimals', () => {
    for (const ok of ['', '1', '12', '12.', '12.5', '12.55', '.', '.5']) expect(isTypingExtra(ok), ok).toBe(true);
    for (const no of ['a', '-', '1.555', '1..', '1234567', ' 1']) expect(isTypingExtra(no), no).toBe(false);
  });

  it('is saved plainly: 12 not 12., 0.5 not .5, blank when it is not a weight', () => {
    expect(canonicalExtra('12.')).toBe('12');
    expect(canonicalExtra('.5')).toBe('0.5');
    expect(canonicalExtra('007.50')).toBe('7.5');
    expect(canonicalExtra('')).toBe('');
    expect(canonicalExtra('.')).toBe('');
  });
});

describe('adding weights', () => {
  it('works in whole hundredths, so no figure has a long tail', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumKg(0.1, 0.2)).toBe(0.3);
    expect(sumKg(389.6, 200.2)).toBe(589.8);
    expect(addKg(414.2, 0.35)).toBe(414.55);
    expect(String(addKg(182.7, 50.1))).toBe('232.8');
    expect(kgText(589.8)).toBe('589.8');
    expect(kgText(1332.6 + 0.01)).toBe('1332.61');
  });

  it('is unknown when either figure is unknown', () => {
    expect(addKg(null, 5)).toBeNull();
    expect(addKg(5, null)).toBeNull();
    expect(sumKg()).toBe(0);
  });
});

describe('following a typed weight through Update from PDF', () => {
  const report = parseFixture('a').report;
  const main = report.sources.findIndex((s) => s.name === 'KARA II L Main');

  it('keeps it when the array of the same name has the same pickup, and moves it to the new position', () => {
    const next = structuredClone(report);
    next.sources.reverse();
    const { kept, reset } = trackExtras(report, next, { [main]: { front: '10', rear: '' } });
    expect(reset).toEqual([]);
    expect(Object.values(kept)).toEqual([{ front: '10', rear: '' }]);
    expect(next.sources[Number(Object.keys(kept)[0])]?.name).toBe('KARA II L Main');
  });

  it('drops one it cannot follow and says which', () => {
    const next = structuredClone(report);
    const target = next.sources.find((s) => s.name === 'KARA II L Main')!;
    target.pickups = target.pickups.map((p) => ({ ...p, position: p.position + 1 }));
    const { kept, reset } = trackExtras(report, next, { [main]: { front: '12.5', rear: '' } });
    expect(kept).toEqual({});
    expect(reset).toEqual([{ array: 'KARA II L Main', side: 'front', weight: '12.5' }]);
  });

  it('drops the weight of an array that is not in the new PDF', () => {
    const next = structuredClone(report);
    next.sources = next.sources.filter((s) => s.name !== 'KARA II L Main');
    const { kept, reset } = trackExtras(report, next, { [main]: { front: '3', rear: '' } });
    expect(kept).toEqual({});
    expect(reset).toHaveLength(1);
  });
});
