import { describe, expect, it } from 'vitest';
import { compareReports } from './compare';
import {
  cleanSymbolValue,
  DEFAULT_SYMBOL_VALUES,
  defaultPair,
  defaultSymbolValues,
  isDefaultMarker,
  isDefaultPair,
  markerPrims,
  SHAPES,
  sameSymbolValues,
  SYMBOL_VALUE_MAX,
  symbolValue,
  trackMarkers,
  type MarkerPair,
} from './markers';
import { numberPickups, plotArrays } from './plot';
import { parseFixture } from '../testing/fixtures';

describe('the four pickup symbols', () => {
  it('start with the values 2 t, 1 t, 0.5 t and 0.25 t in metric tonnes, and the default is the second shape', () => {
    expect(SHAPES).toEqual(['two', 'one', 'half', 'quarter']);
    expect(SHAPES.map((s) => DEFAULT_SYMBOL_VALUES[s])).toEqual(['2 t', '1 t', '0.5 t', '0.25 t']);
    expect(defaultPair().front).toEqual({ shape: 'one' });
    expect(isDefaultPair(defaultPair())).toBe(true);
  });

  it('are drawn as a square with a cross, a circle with a cross, a triangle with a cross and a diamond with a cross', () => {
    const count = (shape: (typeof SHAPES)[number]) => {
      const prims = markerPrims(shape, 2);
      return { lines: prims.filter((p) => p.kind === 'line').length, circles: prims.filter((p) => p.kind === 'circle').length };
    };
    expect(count('two')).toEqual({ lines: 6, circles: 0 });
    expect(count('one')).toEqual({ lines: 2, circles: 1 });
    expect(count('half')).toEqual({ lines: 5, circles: 0 });
    expect(count('quarter')).toEqual({ lines: 6, circles: 0 });
  });

  it('are all the same overall width, centred on the pickup', () => {
    for (const shape of SHAPES) {
      const xs = markerPrims(shape, 10).flatMap((p) => (p.kind === 'line' ? [p.x1, p.x2] : [p.cx - p.r, p.cx + p.r]));
      expect(Math.max(...xs)).toBeCloseTo(5, 9);
      expect(Math.min(...xs)).toBeCloseTo(-5, 9);
    }
  });

  it('point the triangle upwards, with its vertical line from the apex to the middle of the base and a horizontal line through the centre', () => {
    const prims = markerPrims('half', 10).filter((p) => p.kind === 'line');
    const vertical = prims.filter((p) => p.kind === 'line' && p.x1 === 0 && p.x2 === 0);
    expect(vertical).toHaveLength(1);
    expect(Math.max(...prims.flatMap((p) => (p.kind === 'line' ? [p.y1, p.y2] : [])))).toBe(5);
    // The horizontal line sits on the pickup (y = 0) and stays inside the sides of the triangle: 10 / 2 / 1.8 either side.
    const horizontal = prims.filter((p) => p.kind === 'line' && p.y1 === 0 && p.y2 === 0);
    expect(horizontal).toHaveLength(1);
    const h = horizontal[0] as { x1: number; x2: number };
    expect(h.x1).toBeCloseTo(-5 / 1.8, 9);
    expect(h.x2).toBeCloseTo(5 / 1.8, 9);
  });
});

describe('the value written for a symbol', () => {
  it('is the one set for its shape, and a blank one falls back to the usual value', () => {
    const values = { ...defaultSymbolValues(), one: ' 1.5 t ', half: '   ' };
    expect(symbolValue(values, 'one')).toBe('1.5 t');
    expect(symbolValue(values, 'half')).toBe('0.5 t');
    expect(symbolValue(values, 'two')).toBe('2 t');
    expect(isDefaultMarker({ shape: 'one' })).toBe(true);
    expect(isDefaultMarker({ shape: 'two' })).toBe(false);
  });

  it('is one line of plain text of at most 12 characters', () => {
    expect(SYMBOL_VALUE_MAX).toBe(12);
    expect(cleanSymbolValue('1.5\n t\u0000')).toBe('1.5 t');
    expect(cleanSymbolValue('x'.repeat(30))).toHaveLength(12);
  });

  it('compares equal when the written values are the same, whatever blanks stand for the usual ones', () => {
    expect(sameSymbolValues(defaultSymbolValues(), { ...defaultSymbolValues(), two: ' ' })).toBe(true);
    expect(sameSymbolValues(defaultSymbolValues(), { ...defaultSymbolValues(), two: '3 t' })).toBe(false);
  });
});

describe('numbering gives each pickup its symbol', () => {
  it('uses the symbol asked for', () => {
    const { drawn } = plotArrays(parseFixture('c').report.sources);
    const heavy = drawn.find((a) => a.pickups.length > 0 && (a.totalWeight ?? 0) > 1000)!;
    const points = numberPickups(drawn, undefined, (i, side) => (i === heavy.index && side === 'front' ? { shape: 'two' } : { shape: 'one' }));
    const mine = points.filter((p) => p.arrayIndex === heavy.index);
    expect(mine.find((p) => p.which === 'front')).toMatchObject({ marker: { shape: 'two' } });
    for (const p of mine.filter((q) => q.which === 'rear')) expect(p).toMatchObject({ marker: { shape: 'one' } });
  });

  it('gives the default 1 ton symbol everywhere when no choice is made', () => {
    const { drawn } = plotArrays(parseFixture('a').report.sources);
    for (const p of numberPickups(drawn)) expect(p.marker).toEqual({ shape: 'one' });
  });
});

describe('Update from PDF keeps a symbol only for the same pickup', () => {
  const saved = parseFixture('c').report;
  const withPickups = saved.sources.map((s, i) => ({ s, i })).filter(({ s }) => s.pickups.length > 0);
  const { s: pair, i: pairIndex } = withPickups.find(({ s }) => s.pickups.length === 2)!;

  const choice = (): MarkerPair => ({ front: { shape: 'two' }, rear: { shape: 'half' } });

  it('keeps both when the array and both pickups are still there', () => {
    const t = trackMarkers(saved, structuredClone(saved), { [pairIndex]: choice() });
    expect(t.reset).toEqual([]);
    expect(t.kept[pairIndex]).toEqual(choice());
  });

  it('moves a symbol to the new position of the array, matched by name', () => {
    const next = structuredClone(saved);
    next.sources.reverse();
    const t = trackMarkers(saved, next, { [pairIndex]: choice() });
    const newIndex = next.sources.findIndex((s) => s.name === pair.name);
    expect(Object.keys(t.kept)).toEqual([String(newIndex)]);
  });

  it('resets the symbol of a pickup whose position number changed, and lists it', () => {
    const next = structuredClone(saved);
    const target = next.sources[pairIndex]!;
    const rear = target.pickups.find((p) => p.which === 'rear')!;
    rear.position += 1;
    const t = trackMarkers(saved, next, { [pairIndex]: choice() });
    expect(t.kept[pairIndex]).toEqual({ front: { shape: 'two' }, rear: { shape: 'one' } });
    expect(t.reset).toEqual([{ array: pair.name, side: 'rear', shape: 'half' }]);
  });

  it('resets the symbols of an array that is not in the new PDF, and says which', () => {
    const next = structuredClone(saved);
    next.sources.splice(pairIndex, 1);
    const t = trackMarkers(saved, next, { [pairIndex]: choice() });
    expect(t.kept).toEqual({});
    expect(t.reset.map((r) => `${r.side}:${r.shape}`)).toEqual(['front:two', 'rear:half']);
  });

  it('does not list a symbol that is the default, since nothing is lost', () => {
    const t = trackMarkers(saved, { ...saved, sources: [] }, { [pairIndex]: defaultPair() });
    expect(t.reset).toEqual([]);
  });

  it('is told to the person in the comparison, one line for each symbol that cannot be followed', () => {
    const changes = compareReports(saved, saved, new Set(), {}, [{ array: pair.name, side: 'rear', value: '0.5 t', fallback: '1 t' }]);
    expect(changes).toEqual([
      { kind: 'changed', array: pair.name, what: 'Plot symbol, rear pickup', saved: '0.5 t', now: 'back to 1 t, because the new PDF has no such pickup for this array' },
    ]);
  });
});
