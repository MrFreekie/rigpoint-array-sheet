import { describe, expect, it } from 'vitest';
import { compareReports } from './compare';
import {
  cleanMarkerText,
  defaultPair,
  isCustom,
  isDefaultMarker,
  isDefaultPair,
  isGreyed,
  markerPrims,
  markerValue,
  MARKER_TEXT_MAX,
  RATING_KG,
  RATING_LABEL,
  SHAPES,
  shapeBelow,
  trackMarkers,
  type MarkerPair,
} from './markers';
import { numberPickups, plotArrays } from './plot';
import { parseFixture } from '../testing/fixtures';

describe('the four pickup symbols', () => {
  it('stand for 2 ton, 1 ton, half ton and quarter ton in metric tonnes, and the default is 1 ton', () => {
    expect(SHAPES).toEqual(['two', 'one', 'half', 'quarter']);
    expect(SHAPES.map((s) => RATING_KG[s])).toEqual([2000, 1000, 500, 250]);
    expect(SHAPES.map((s) => RATING_LABEL[s])).toEqual(['2 t', '1 t', '0.5 t', '0.25 t']);
    expect(defaultPair().front).toEqual({ shape: 'one', text: '' });
    expect(isDefaultPair(defaultPair())).toBe(true);
  });

  it('are drawn as a square with a cross, a circle with a cross, a triangle with a vertical line and a diamond with a cross', () => {
    const count = (shape: (typeof SHAPES)[number]) => {
      const prims = markerPrims(shape, 2);
      return { lines: prims.filter((p) => p.kind === 'line').length, circles: prims.filter((p) => p.kind === 'circle').length };
    };
    expect(count('two')).toEqual({ lines: 6, circles: 0 });
    expect(count('one')).toEqual({ lines: 2, circles: 1 });
    expect(count('half')).toEqual({ lines: 4, circles: 0 });
    expect(count('quarter')).toEqual({ lines: 6, circles: 0 });
  });

  it('are all the same overall width, centred on the pickup', () => {
    for (const shape of SHAPES) {
      const xs = markerPrims(shape, 10).flatMap((p) => (p.kind === 'line' ? [p.x1, p.x2] : [p.cx - p.r, p.cx + p.r]));
      expect(Math.max(...xs)).toBeCloseTo(5, 9);
      expect(Math.min(...xs)).toBeCloseTo(-5, 9);
    }
  });

  it('point the triangle upwards, with its vertical line from the apex to the middle of the base', () => {
    const prims = markerPrims('half', 10).filter((p) => p.kind === 'line');
    const vertical = prims.filter((p) => p.kind === 'line' && p.x1 === 0 && p.x2 === 0);
    expect(vertical).toHaveLength(1);
    expect(Math.max(...prims.flatMap((p) => (p.kind === 'line' ? [p.y1, p.y2] : [])))).toBe(5);
  });
});

describe('greying a symbol', () => {
  it('greys a symbol whose rating is below the stated total weight, so 1 ton is grey on a 1333 kg array', () => {
    expect(isGreyed({ shape: 'one', text: '' }, 1333)).toBe(true);
    expect(isGreyed({ shape: 'half', text: '' }, 1333)).toBe(true);
    expect(isGreyed({ shape: 'quarter', text: '' }, 1333)).toBe(true);
    expect(isGreyed({ shape: 'two', text: '' }, 1333)).toBe(false);
  });

  it('does not grey a symbol that is equal to the total weight or above it, or when no total is stated', () => {
    expect(isGreyed({ shape: 'one', text: '' }, 1000)).toBe(false);
    expect(isGreyed({ shape: 'one', text: '' }, 414.2)).toBe(false);
    expect(isGreyed({ shape: 'quarter', text: '' }, null)).toBe(false);
    expect(shapeBelow('one', null)).toBe(false);
  });

  it('never greys a symbol with typed text', () => {
    expect(isGreyed({ shape: 'quarter', text: '1.5 t' }, 5000)).toBe(false);
  });
});

describe('what a symbol is worth', () => {
  it('is its typed text, else the rating of its shape', () => {
    expect(markerValue({ shape: 'half', text: '' })).toBe('0.5 t');
    expect(markerValue({ shape: 'one', text: ' 1.5 t ' })).toBe('1.5 t');
    expect(isCustom({ shape: 'one', text: '  ' })).toBe(false);
    expect(isDefaultMarker({ shape: 'one', text: ' ' })).toBe(true);
  });

  it('is one line of plain text of at most 12 characters', () => {
    expect(MARKER_TEXT_MAX).toBe(12);
    expect(cleanMarkerText('1.5\n t\u0000')).toBe('1.5 t');
    expect(cleanMarkerText('x'.repeat(30))).toHaveLength(12);
  });
});

describe('numbering gives each pickup its symbol', () => {
  it('uses the symbol asked for, and greys it by the array total', () => {
    const { drawn } = plotArrays(parseFixture('c').report.sources);
    const heavy = drawn.find((a) => a.pickups.length > 0 && (a.totalWeight ?? 0) > 1000)!;
    const points = numberPickups(drawn, undefined, (i, side) => (i === heavy.index && side === 'front' ? { shape: 'two', text: '' } : { shape: 'one', text: '' }));
    const mine = points.filter((p) => p.arrayIndex === heavy.index);
    expect(mine.find((p) => p.which === 'front')).toMatchObject({ marker: { shape: 'two' }, greyed: false });
    for (const p of mine.filter((q) => q.which === 'rear')) expect(p).toMatchObject({ marker: { shape: 'one' }, greyed: true });
  });

  it('gives the default 1 ton symbol everywhere when no choice is made', () => {
    const { drawn } = plotArrays(parseFixture('a').report.sources);
    for (const p of numberPickups(drawn)) expect(p.marker).toEqual({ shape: 'one', text: '' });
  });
});

describe('Update from PDF keeps a symbol only for the same pickup', () => {
  const saved = parseFixture('c').report;
  const withPickups = saved.sources.map((s, i) => ({ s, i })).filter(({ s }) => s.pickups.length > 0);
  const { s: pair, i: pairIndex } = withPickups.find(({ s }) => s.pickups.length === 2)!;

  const choice = (front: string, rear: string): MarkerPair => ({ front: { shape: 'two', text: front }, rear: { shape: 'half', text: rear } });

  it('keeps both when the array and both pickups are still there', () => {
    const t = trackMarkers(saved, structuredClone(saved), { [pairIndex]: choice('1.5 t', '') });
    expect(t.reset).toEqual([]);
    expect(t.kept[pairIndex]).toEqual(choice('1.5 t', ''));
  });

  it('moves a symbol to the new position of the array, matched by name', () => {
    const next = structuredClone(saved);
    next.sources.reverse();
    const t = trackMarkers(saved, next, { [pairIndex]: choice('', '') });
    const newIndex = next.sources.findIndex((s) => s.name === pair.name);
    expect(Object.keys(t.kept)).toEqual([String(newIndex)]);
  });

  it('resets the symbol of a pickup whose position number changed, and lists it', () => {
    const next = structuredClone(saved);
    const target = next.sources[pairIndex]!;
    const rear = target.pickups.find((p) => p.which === 'rear')!;
    rear.position += 1;
    const t = trackMarkers(saved, next, { [pairIndex]: choice('', '') });
    expect(t.kept[pairIndex]).toEqual({ front: { shape: 'two', text: '' }, rear: { shape: 'one', text: '' } });
    expect(t.reset).toEqual([{ array: pair.name, side: 'rear', value: '0.5 t' }]);
  });

  it('resets the symbols of an array that is not in the new PDF, and says which', () => {
    const next = structuredClone(saved);
    next.sources.splice(pairIndex, 1);
    const t = trackMarkers(saved, next, { [pairIndex]: choice('1.5 t', '') });
    expect(t.kept).toEqual({});
    expect(t.reset.map((r) => `${r.side}:${r.value}`)).toEqual(['front:1.5 t', 'rear:0.5 t']);
  });

  it('does not list a symbol that is the default, since nothing is lost', () => {
    const t = trackMarkers(saved, { ...saved, sources: [] }, { [pairIndex]: defaultPair() });
    expect(t.reset).toEqual([]);
  });

  it('is told to the person in the comparison, one line for each symbol that cannot be followed', () => {
    const changes = compareReports(saved, saved, new Set(), {}, [{ array: pair.name, side: 'rear', value: '0.5 t' }]);
    expect(changes).toEqual([
      { kind: 'changed', array: pair.name, what: 'Plot symbol, rear pickup', saved: '0.5 t', now: 'back to 1 t, because the new PDF has no such pickup for this array' },
    ]);
  });
});
