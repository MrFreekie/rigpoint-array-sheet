import { describe, expect, it } from 'vitest';
import {
  autoBreaks,
  cartShade,
  CART_SHADE,
  defaultCartSizes,
  forcedBreaks,
  groupsOf,
  groupsText,
  normaliseBreaks,
  sizeFor,
  toggleBreak,
  trackCarts,
  type CartRow,
} from './carts';
import type { Report } from './types';

const rows = (...runs: [string, number, (number | null)?][]): CartRow[] => runs.flatMap(([type, n, column]) => Array.from({ length: n }, () => ({ type, column: column ?? null })));
const sizes = defaultCartSizes();
const size = (type: string) => sizeFor(sizes, type);
const cut = (r: CartRow[], mounting: 'flown' | 'stacked' | null = 'flown', fn: (t: string) => number | undefined = size) => autoBreaks(r, fn, mounting);

describe('autoBreaks', () => {
  it('cuts a mixed array from the top: 8 K2 then 6 KARA II give 4 + 4 + 3 + 3', () => {
    const breaks = cut(rows(['K2', 8], ['KARA II', 6]));
    expect(breaks).toEqual([4, 8, 11]);
    expect(groupsOf(breaks, 14)).toEqual([4, 4, 3, 3]);
  });

  it('leaves the short cart last on a flown array and first on a stacked one', () => {
    expect(groupsOf(cut(rows(['K2', 10])), 10)).toEqual([4, 4, 2]);
    expect(groupsOf(cut(rows(['K2', 10]), 'stacked'), 10)).toEqual([2, 4, 4]);
  });

  it('cuts a stacked array from the bottom with a custom size', () => {
    const breaks = cut(rows(['X', 7]), 'stacked', () => 3);
    expect(breaks).toEqual([1, 4]);
    expect(groupsOf(breaks, 7)).toEqual([1, 3, 3]);
  });

  it('treats a mounting that is not stated as flown', () => {
    expect(cut(rows(['K2', 10]), null)).toEqual(cut(rows(['K2', 10]), 'flown'));
  });

  it('leaves a type with no size whole', () => {
    expect(cut(rows(['X8', 12]))).toEqual([]);
  });

  it('breaks where the type changes even when the type is uncut', () => {
    const breaks = cut(rows(['K1-SB', 2], ['K1', 12]));
    expect(breaks).toEqual([2]);
    expect(groupsOf(breaks, 14)).toEqual([2, 12]);
  });

  it('does not cut a run that is no longer than its size', () => {
    expect(cut(rows(['K2', 4]))).toEqual([]);
    expect(cut(rows(['K2', 3]))).toEqual([]);
  });

  it('has no break for one enclosure, with or without a size, and none for an empty table', () => {
    expect(cut(rows(['K2', 1]))).toEqual([]);
    expect(cut(rows(['X', 1]), 'flown', () => 1)).toEqual([]);
    expect(cut([])).toEqual([]);
    expect(groupsOf([], 0)).toEqual([]);
  });

  it('breaks at every change of type, A then B then A', () => {
    expect(cut(rows(['A', 1], ['B', 1], ['A', 1]))).toEqual([1, 2]);
  });

  it('breaks where the stack column changes, so a cart never spans two columns', () => {
    const r = [...rows(['X', 3, 1]), ...rows(['X', 3, 2])];
    const breaks = cut(r, 'stacked', () => 2);
    expect(breaks).toEqual([1, 3, 4]);
    expect(groupsOf(breaks, 6)).toEqual([1, 2, 1, 2]);
  });

  it('cuts every type by one size when asked', () => {
    const breaks = cut(rows(['K2', 8], ['KARA II', 6]), 'flown', () => 6);
    expect(breaks).toEqual([6, 8]);
    expect(groupsOf(breaks, 14)).toEqual([6, 2, 6]);
  });

  it('matches a type after trimming and ignoring case', () => {
    expect(sizeFor(sizes, ' k2 ')).toBe(4);
    expect(sizeFor(sizes, 'KARA II')).toBe(3);
    expect(sizeFor(sizes, 'KARA')).toBe(3);
    expect(sizeFor(sizes, 'KARA III')).toBeUndefined();
    expect(cut(rows(['k2 ', 8]))).toEqual([4]);
  });
});

describe('breaks', () => {
  it('reads the forced breaks from type and column changes', () => {
    expect(forcedBreaks(rows(['A', 2], ['B', 1]))).toEqual([2]);
    expect(forcedBreaks(rows(['A', 2, 1], ['A', 2, 2]))).toEqual([2]);
    expect(forcedBreaks(rows(['A', 3]))).toEqual([]);
  });

  it('makes breaks safe: whole numbers inside the table, the forced ones added, sorted, once each', () => {
    expect(normaliseBreaks([5, 3, 3, 0, 9, 2.5, -1], [4], 9)).toEqual([3, 4, 5]);
  });

  it('adds and removes a break, but never removes a forced one', () => {
    expect(toggleBreak([], 3, [], 6)).toEqual([3]);
    expect(toggleBreak([3], 3, [], 6)).toEqual([]);
    expect(toggleBreak([2], 2, [2], 6)).toEqual([2]);
  });

  it('describes the carts as a sum', () => {
    expect(groupsText([4, 4, 3, 3])).toBe('4 + 4 + 3 + 3');
    expect(groupsText([14])).toBe('14, one block');
    expect(groupsText([])).toBe('none');
  });
});

describe('cartShade', () => {
  it('shades every other cart, counted from the top, and leaves the first white', () => {
    expect(cartShade([2, 4], 6)).toEqual([false, false, true, true, false, false]);
  });

  it('shades nothing when there is one cart', () => {
    expect(cartShade([], 5)).toEqual([false, false, false, false, false]);
  });

  it('has the same length as the table', () => {
    expect(cartShade([1, 2, 3], 7)).toHaveLength(7);
  });

  it('uses a neutral grey 20 steps of printer luma below white', () => {
    expect(CART_SHADE).toBe('#ebebeb');
    const n = parseInt(CART_SHADE.slice(1), 16);
    const luma = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    expect(Math.round(luma)).toBe(235);
  });
});

function report(...arrays: { name: string; types: string[] }[]): Report {
  return {
    document: { version: null, date: null, fileName: null },
    sources: arrays.map((a) => ({
      name: a.name,
      cabinets: a.types.map((type, i) => ({ number: i + 1, type, angle: null, site: null, topZ: null, bottomZ: null, panflex: null })),
    })),
  } as unknown as Report;
}

describe('trackCarts', () => {
  const saved = report({ name: 'A', types: ['K2', 'K2', 'K2', 'K2', 'KARA II', 'KARA II'] }, { name: 'B', types: ['K2', 'K2'] });

  it('keeps a hand cut array when the rows and the types are the same, even when the array moves', () => {
    const next = report({ name: 'B', types: ['K2', 'K2'] }, { name: 'A', types: ['K2', 'K2', 'K2', 'K2', 'KARA II', 'KARA II'] });
    const t = trackCarts(saved, next, { 0: [2, 4] });
    expect(t.kept).toEqual({ 1: [2, 4] });
    expect(t.reset).toEqual([]);
  });

  it('returns the array to automatic and lists it when the row count differs', () => {
    const next = report({ name: 'A', types: ['K2', 'K2', 'K2', 'K2', 'KARA II'] });
    const t = trackCarts(saved, next, { 0: [2, 4] });
    expect(t.kept).toEqual({});
    expect(t.reset).toEqual([{ array: 'A', groups: '2 + 2 + 2' }]);
  });

  it('returns the array to automatic when the types are in a different order', () => {
    const next = report({ name: 'A', types: ['K2', 'K2', 'KARA II', 'K2', 'K2', 'KARA II'] });
    expect(trackCarts(saved, next, { 0: [2, 4] }).reset).toHaveLength(1);
  });

  it('does not list an array the new PDF no longer has', () => {
    const next = report({ name: 'B', types: ['K2', 'K2'] });
    const t = trackCarts(saved, next, { 0: [2, 4] });
    expect(t).toEqual({ kept: {}, reset: [] });
  });

  it('lists nothing for an array that was automatic', () => {
    const next = report({ name: 'A', types: ['K2'] });
    expect(trackCarts(saved, next, {})).toEqual({ kept: {}, reset: [] });
  });
});
