import { describe, expect, it } from 'vitest';
import { GRID_DEFAULT_M, gridText, parseGridM } from './grid';

describe('grid size', () => {
  it('reads whole and half metres from 1 to 100', () => {
    expect(parseGridM('10')).toBe(10);
    expect(parseGridM(' 2,5 ')).toBe(2.5);
    expect(parseGridM('100')).toBe(100);
    expect(parseGridM('1')).toBe(1);
  });

  it('refuses blanks, zero, too big, too small and odd text', () => {
    for (const t of ['', '0', '0.5', '101', '1000', '-5', 'ten', '1.234', '1e2', '5.']) expect(parseGridM(t)).toBeNull();
  });

  it('writes the size without a trailing zero', () => {
    expect(gridText(GRID_DEFAULT_M)).toBe('10');
    expect(gridText(2.5)).toBe('2.5');
  });
});
