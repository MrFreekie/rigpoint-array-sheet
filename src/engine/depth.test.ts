import { describe, expect, it } from 'vitest';
import { canonicalDepth, DEPTH_MAX_M, isTypingDepth, isValidDepth, parseDepthM } from './depth';

describe('pickup to max depth text', () => {
  it('reads metres above 0 with at most 2 decimals, a comma too', () => {
    expect(parseDepthM('1.25')).toBe(1.25);
    expect(parseDepthM(' 2,5 ')).toBe(2.5);
    expect(parseDepthM('20')).toBe(DEPTH_MAX_M);
  });

  it('rejects blank, zero, too large, too fine and text', () => {
    for (const bad of ['', '0', '0.00', '20.01', '21', '1.234', '-1', 'x', '1.', '.5', '100']) expect(parseDepthM(bad)).toBeNull();
  });

  it('accepts blank or a depth as a saved value, and writes it plainly', () => {
    expect(isValidDepth('')).toBe(true);
    expect(isValidDepth('3.1')).toBe(true);
    expect(isValidDepth('0')).toBe(false);
    expect(canonicalDepth('2,50')).toBe('2.5');
    expect(canonicalDepth('bad')).toBe('');
  });

  it('lets a depth be typed a character at a time', () => {
    for (const ok of ['', '1', '1.', '1.2', '12.34', '1,5']) expect(isTypingDepth(ok)).toBe(true);
    for (const no of ['123', '1.234', 'a', '-1', '1..']) expect(isTypingDepth(no)).toBe(false);
  });
});
