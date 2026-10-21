import { describe, expect, it } from 'vitest';
import { degrees, kg, metres, NOT_STATED, num } from './format';

describe('format', () => {
  it('shows figures as printed, with their unit', () => {
    expect(num(7.5)).toBe('7.5');
    expect(kg(414.2)).toBe('414.2 kg');
    expect(metres(9.4)).toBe('9.4 m');
    expect(degrees(-41.2)).toBe('-41.2°');
  });

  it('keeps a real zero and shows a dash for a missing figure', () => {
    expect(kg(0)).toBe('0 kg');
    expect(num(0)).toBe('0');
    for (const f of [num, kg, metres, degrees]) {
      expect(f(null)).toBe(NOT_STATED);
      expect(f(undefined)).toBe(NOT_STATED);
    }
  });
});
