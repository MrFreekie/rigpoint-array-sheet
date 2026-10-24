import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { fitPatch, isPatchValue, PATCH_COLOURS, PATCH_DIGITS, PATCH_LUMA_ORDER, patchUsed, printerLuma, trackPatches, type PatchDigit, type PatchRow } from './patch';
import type { Report } from './types';

/** Relative luminance as WCAG defines it, from a #rrggbb colour. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('patch digits', () => {
  it('are listed 1 to 9 and then 0, and blank is also a value', () => {
    expect([...PATCH_DIGITS]).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    for (const v of ['', ...PATCH_DIGITS]) expect(isPatchValue(v)).toBe(true);
    for (const v of ['10', ' 1', 'a', '-', 1, null, undefined]) expect(isPatchValue(v)).toBe(false);
  });
});

describe('patch colours', () => {
  it('follow the resistor code', () => {
    expect(PATCH_DIGITS.map((d) => PATCH_COLOURS[d].name)).toEqual(['brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white', 'black']);
  });

  it('are ten different chips', () => {
    expect(new Set(PATCH_DIGITS.map((d) => PATCH_COLOURS[d].fill)).size).toBe(10);
  });

  it('rise from dark to light in the order black, brown, blue, violet, red, green, orange, grey, yellow, white, in steps of at least 20 out of 255', () => {
    const lumas = PATCH_LUMA_ORDER.map((d) => printerLuma(PATCH_COLOURS[d].fill));
    expect([...PATCH_LUMA_ORDER].sort().join('')).toBe([...PATCH_DIGITS].sort().join(''));
    for (let i = 0; i + 1 < lumas.length; i++) {
      expect((lumas[i + 1] as number) - (lumas[i] as number), `${PATCH_COLOURS[PATCH_LUMA_ORDER[i] as PatchDigit].name} to ${PATCH_COLOURS[PATCH_LUMA_ORDER[i + 1] as PatchDigit].name}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('keep the digit readable on its chip', () => {
    for (const d of PATCH_DIGITS) expect(contrast(PATCH_COLOURS[d].fill, PATCH_COLOURS[d].text), PATCH_COLOURS[d].name).toBeGreaterThanOrEqual(4.5);
  });

  it('outline the white chip and no other, with a dark line', () => {
    for (const d of PATCH_DIGITS) {
      const c = PATCH_COLOURS[d];
      if (c.name === 'white') expect(contrast(c.outline as string, '#ffffff')).toBeGreaterThanOrEqual(10);
      else expect(c.outline).toBeNull();
    }
  });
});

describe('fitPatch and patchUsed', () => {
  it('pads a short list with blanks and cuts a long one', () => {
    const rows: PatchRow[] = [{ feeder: '1', way: '2' }];
    expect(fitPatch(rows, 3)).toEqual([{ feeder: '1', way: '2' }, { feeder: '', way: '' }, { feeder: '', way: '' }]);
    expect(fitPatch([...rows, ...rows], 1)).toHaveLength(1);
    expect(fitPatch(undefined, 2)).toHaveLength(2);
    expect(patchUsed(fitPatch(undefined, 2))).toBe(false);
    expect(patchUsed([{ feeder: '', way: '0' }])).toBe(true);
  });
});

describe('trackPatches (Update from PDF)', () => {
  const report = (): Report => parseFixture('a').report;
  const mark = (rows: number, at: number): PatchRow[] => fitPatch([], rows).map((r, i) => (i === at ? { feeder: '2', way: '3' } : r));

  it('keeps a patch row for row when the array has the same name and the same number of enclosures', () => {
    const saved = report();
    const next = structuredClone(saved);
    const n = saved.sources[0]?.cabinets.length ?? 0;
    const out = trackPatches(saved, next, { 0: mark(n, 1) });
    expect(out.reset).toEqual([]);
    expect(out.kept[0]?.[1]).toEqual({ feeder: '2', way: '3' });
    expect(out.kept[0]).toHaveLength(n);
  });

  it('follows the array to its new position by name', () => {
    const saved = report();
    const next = structuredClone(saved);
    next.sources.reverse();
    const n = saved.sources[0]?.cabinets.length ?? 0;
    const out = trackPatches(saved, next, { 0: mark(n, 0) });
    expect(Object.keys(out.kept)).toEqual([String(next.sources.length - 1)]);
  });

  it('clears the patch and lists the array when the enclosure count differs', () => {
    const saved = report();
    const next = structuredClone(saved);
    const n = saved.sources[0]?.cabinets.length ?? 0;
    next.sources[0]?.cabinets.pop();
    const out = trackPatches(saved, next, { 0: mark(n, 0) });
    expect(out.kept).toEqual({});
    expect(out.reset).toEqual([{ array: saved.sources[0]?.name, rows: 1, wasRows: n, nowRows: n - 1 }]);
  });

  it('says nothing about an array with no patch set, or one the new PDF no longer has', () => {
    const saved = report();
    const next = structuredClone(saved);
    const n = saved.sources[0]?.cabinets.length ?? 0;
    const out = trackPatches(saved, next, { 0: fitPatch([], n) });
    expect(out).toEqual({ kept: {}, reset: [] });
    next.sources.shift();
    expect(trackPatches(saved, next, { 0: mark(n, 0) })).toEqual({ kept: {}, reset: [] });
  });
});
