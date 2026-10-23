import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { footprint, numberPickups, planSpacing, plotArrays, type PlotArray } from './plot';
import type { ArraySource } from './types';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('footprint', () => {
  const base = { position: { x: 10, y: 20, z: 5 }, dimensions: { x: 2, y: 3, z: 4 } };

  it('runs rearward from the front edge, centred on Position x, at azimuth 0', () => {
    const c = footprint({ ...base, azimuth: 0 })!;
    near(c[0].x, 9);
    near(c[0].y, 20);
    near(c[1].x, 11);
    near(c[2].y, 17);
    near(c[3].x, 9);
  });

  it('turns clockwise from +Y, like a compass bearing', () => {
    // Facing east (+X): the rear is to the west and the front-left corner is to the north.
    const c = footprint({ ...base, azimuth: 90 })!;
    near(c[0].x, 10);
    near(c[0].y, 21);
    near(c[1].y, 19);
    near(c[2].x, 7);
  });

  it('faces the audience away at 180 and mirrors at -90', () => {
    const c = footprint({ ...base, azimuth: 180 })!;
    near(c[2].y, 23);
    const w = footprint({ ...base, azimuth: -90 })!;
    near(w[2].x, 13);
  });

  it('is null when the report lacks a position, a size or an azimuth', () => {
    expect(footprint({ ...base, azimuth: null })).toBeNull();
    expect(footprint({ position: null, dimensions: base.dimensions, azimuth: 0 })).toBeNull();
    expect(footprint({ position: base.position, dimensions: null, azimuth: 0 })).toBeNull();
  });
});

describe('footprint against the sample reports', () => {
  it('puts every pickup on the centre line of its box, which fixes the azimuth convention', () => {
    for (const name of ['a', 'c', 'e'] as const) {
      const sources = parseFixture(name).report.sources;
      for (const s of sources) {
        const c = footprint(s);
        if (!c || s.pickups.length === 0 || s.mounting !== 'flown') continue;
        const mid = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 };
        const across = { x: c[1].x - c[0].x, y: c[1].y - c[0].y };
        const len = Math.hypot(across.x, across.y);
        for (const p of s.pickups) {
          const off = ((p.at.x - mid.x) * across.x + (p.at.y - mid.y) * across.y) / len;
          expect(Math.abs(off), `${name}: ${s.name}`).toBeLessThan(0.02);
        }
      }
    }
  });
});

describe('front and rear pickups against the sample reports', () => {
  it('puts the front pickup forward of the rear one along the array axis', () => {
    let checked = 0;
    for (const name of ['a', 'c', 'e'] as const) {
      for (const src of parseFixture(name).report.sources) {
        const front = src.pickups.find((p) => p.which === 'front');
        const rear = src.pickups.find((p) => p.which === 'rear');
        if (!front || !rear || src.azimuth === null || src.mounting !== 'flown') continue;
        const az = (src.azimuth * Math.PI) / 180;
        // Along the way the array faces, clockwise from +Y.
        const along = (front.at.x - rear.at.x) * Math.sin(az) + (front.at.y - rear.at.y) * Math.cos(az);
        expect(along, `${name}: ${src.name}`).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('plotArrays', () => {
  it('keeps flown and stacked arrays, mirrors included, and tells them apart', () => {
    const a = parseFixture('a').report.sources;
    const { drawn, notDrawn } = plotArrays(a);
    expect(notDrawn).toEqual([]);
    expect(drawn.map((d) => d.name)).toContain('KARA II R Main');
    expect(drawn.every((d) => d.kind === a[d.index]?.mounting)).toBe(true);
    expect(drawn.filter((d) => d.kind === 'stacked').map((d) => d.name)).toEqual(['SB28 L Front', 'SB28 R Front', 'SB28 L Rear', 'SB28 R Rear']);
    expect(drawn.filter((d) => d.kind === 'stacked').every((d) => d.pickups.length === 0)).toBe(true);
  });

  it('puts the fixation positions of a stack on the corners of its box, so Position is the front edge for stacks too', () => {
    let checked = 0;
    for (const s of parseFixture('e').report.sources) {
      const c = footprint(s);
      if (s.mounting !== 'stacked' || !c || !s.fixations || s.fixations.length === 0) continue;
      const mid = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 };
      const rear = { x: (c[3].x + c[2].x) / 2, y: (c[3].y + c[2].y) / 2 };
      const depth = Math.hypot(rear.x - mid.x, rear.y - mid.y);
      const axis = { x: (rear.x - mid.x) / depth, y: (rear.y - mid.y) / depth };
      for (const f of s.fixations) {
        const along = (f.at.x - mid.x) * axis.x + (f.at.y - mid.y) * axis.y;
        // Front fixations (Fr, Fl) sit on the front edge, rear ones (Rr, Rl) on the rear edge.
        expect(Math.abs(along - (f.name.startsWith('F') ? 0 : depth)), `${s.name} ${f.name}`).toBeLessThan(0.02);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('draws an array whose mounting the report does not say, and names only arrays that lack a position, size or azimuth', () => {
    const sources = parseFixture('a').report.sources;
    const unknown: ArraySource[] = sources.map((s, i) => (i === 0 ? { ...s, mounting: null } : i === 1 ? { ...s, mounting: null, azimuth: null } : s));
    const { drawn, notDrawn } = plotArrays(unknown, new Set([0, 1]));
    expect(drawn.map((d) => d.name)).toEqual([sources[0]?.name]);
    expect(drawn[0]?.kind).toBe('flown');
    expect(notDrawn).toEqual([sources[1]?.name]);
  });

  it('draws only the arrays asked for, and names the ones it cannot draw', () => {
    const sources = parseFixture('a').report.sources;
    expect(plotArrays(sources, new Set([0])).drawn.map((d) => d.index)).toEqual([0]);
    const broken: ArraySource[] = sources.map((s, i) => (i === 0 ? { ...s, azimuth: null } : s));
    expect(plotArrays(broken, new Set([0, 1])).notDrawn).toEqual([broken[0]?.name]);
  });
});

function arr(index: number, x: number, y: number, pickups: ('front' | 'rear')[]): PlotArray {
  return {
    index,
    name: `A${index}`,
    kind: 'flown',
    position: { x, y, z: 5 },
    corners: [
      { x, y },
      { x, y },
      { x, y },
      { x, y },
    ],
    pickups: pickups.map((which, i) => ({ which, position: i + 1, at: { x, y, z: 5 } })),
    frontMotorLoad: 100,
    rearMotorLoad: 200,
    totalWeight: 300,
  };
}

describe('numberPickups', () => {
  it('numbers rows from the highest Y, house left (highest X) first, front before rear', () => {
    const pts = numberPickups([arr(0, -10, 2, ['rear', 'front']), arr(1, 10, 2.5, ['front', 'rear']), arr(2, 0, 20, ['front'])]);
    expect(pts.map((p) => `${p.label}:${p.arrayIndex}:${p.which}`)).toEqual(['PA1:2:front', 'PA2:1:front', 'PA3:1:rear', 'PA4:0:front', 'PA5:0:rear']);
  });

  it('puts arrays 1.0 m apart in one row and further apart in two', () => {
    const together = numberPickups([arr(0, 5, 10, ['front']), arr(1, 8, 9, ['front'])]);
    expect(together.map((p) => p.arrayIndex)).toEqual([1, 0]);
    const apart = numberPickups([arr(0, 5, 10, ['front']), arr(1, 8, 8.99, ['front'])]);
    expect(apart.map((p) => p.arrayIndex)).toEqual([0, 1]);
  });

  it('does not number an array with no pickup, and labels a single pickup once', () => {
    const pts = numberPickups([arr(0, 0, 5, []), arr(1, 1, 4.5, ['front'])]);
    expect(pts).toHaveLength(1);
    expect(pts[0]?.label).toBe('PA1');
    expect(pts[0]?.single).toBe(true);
  });

  it('gives each pickup the motor load of its side', () => {
    const pts = numberPickups([arr(0, 0, 5, ['front', 'rear'])]);
    expect(pts.map((p) => p.load)).toEqual([100, 200]);
    expect(pts.map((p) => p.single)).toEqual([false, false]);
  });

  it('numbers report C: both K1 rows, front lower than rear', () => {
    const { drawn } = plotArrays(parseFixture('c').report.sources);
    const pts = numberPickups(drawn);
    expect(pts.slice(0, 4).map((p) => `${p.source}:${p.which}`)).toEqual(['K2 Left:front', 'K2 Left:rear', 'K2 Right:front', 'K2 Right:rear']);
    expect(pts.map((p) => p.number)).toEqual(pts.map((_, i) => i + 1));
  });
});

describe('planSpacing', () => {
  it('is the distance on the plan, rounded to 2 decimals', () => {
    expect(planSpacing({ x: 11.4, y: 2.16 }, { x: 11.4, y: 1.15 })).toBe(1.01);
    expect(planSpacing({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(planSpacing({ x: 0.001, y: 0 }, { x: 0, y: 0.002 })).toBe(0);
  });

  it('ignores height, and sits on the front pickup of an array that has both', () => {
    const arrays = plotArrays(parseFixture('c').report.sources).drawn;
    const pts = numberPickups(arrays);
    const withBoth = arrays.filter((a) => a.pickups.length === 2);
    expect(withBoth.length).toBeGreaterThan(0);
    for (const a of withBoth) {
      const f = pts.find((p) => p.arrayIndex === a.index && p.which === 'front')!;
      const r = pts.find((p) => p.arrayIndex === a.index && p.which === 'rear')!;
      expect(f.spacing).toBe(planSpacing(f.at, r.at));
      expect(r.spacing).toBeNull();
    }
    // A pickup 45 m higher than the other changes nothing: only X and Y count.
    const tall = arr(0, 0, 0, ['front', 'rear']);
    tall.pickups = [{ which: 'front', position: 1, at: { x: 0, y: 0, z: 5 } }, { which: 'rear', position: 2, at: { x: 3, y: 4, z: 50 } }];
    expect(numberPickups([tall])[0]!.spacing).toBe(5);
    for (const a of arrays.filter((x) => x.pickups.length === 1)) expect(pts.find((p) => p.arrayIndex === a.index)!.spacing).toBeNull();
  });
});
