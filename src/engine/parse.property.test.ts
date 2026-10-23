// Property test: any report drawn in the Soundvision layout reads back exactly,
// wherever the page breaks fall, and reads without a single problem.

import { describe, expect, it } from 'vitest';
import { loadItems } from '../testing/fixtures';
import { rng } from '../testing/random';
import { renderReport, type RenderedSource } from '../testing/render-report';
import { parseSoundvision } from './parse';
import type { Cabinet, ReportDocument } from './types';

const DOCUMENT: ReportDocument = {
  version: '2026.3.1',
  author: 'Example Author',
  date: '2026/10/21',
  fileName: 'Example Show.xmlp',
  distanceUnit: 'm',
  weightUnit: 'kg',
};

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

function randomSource(r: ReturnType<typeof rng>, number: number): RenderedSource {
  const flown = r.chance(0.7);
  const count = r.int(1, 24);
  let site = round(r.int(-100, 300) / 10, 1);
  let z = round(r.int(60, 120) / 10, 2);
  const cabinets: Cabinet[] = [];
  const withAngles = count > 1 || r.chance(0.5);
  for (let n = 1; n <= count; n++) {
    const angle = n === 1 ? r.int(0, 10) : r.pick([0, 1, 2, 3, 4, 5, 7.5, 10]);
    if (n > 1) site = round(site - angle, 1);
    const top = z;
    const bottom = round(top - r.pick([0.25, 0.5, 0.49]), 2);
    cabinets.push({
      number: n,
      type: r.pick(['KARA II', 'SB18', 'K2', 'X12']),
      angle: withAngles ? angle : null,
      site,
      topZ: top,
      bottomZ: bottom,
      panflex: r.pick(['35/35', '55/55', '35/55', '55/35']),
    });
    z = bottom;
  }
  // A ground stack may be laid out in columns, each numbered from #1.
  if (!flown && count > 1 && r.chance(0.5)) {
    const columns = r.int(2, 3);
    const seen: number[] = Array(columns).fill(0);
    cabinets.forEach((c, i) => {
      const column = (i % columns) + 1;
      seen[column - 1]! += 1;
      c.column = column;
      c.number = seen[column - 1]!;
    });
    cabinets.sort((x, y) => (x.column ?? 0) - (y.column ?? 0) || x.number - y.number);
  }
  const motors = flown ? r.int(1, 2) : null;
  const pt = () => ({ x: round(r.int(-2000, 2000) / 100, 2), y: round(r.int(0, 1500) / 100, 2), z: round(r.int(0, 1200) / 100, 2) });
  const orientation = r.pick(['vertical', 'horizontal'] as const);
  return {
    number,
    name: `Array ${number}`,
    groups: [],
    configuration: `${orientation}, ${flown ? 'flown' : 'stacked'} array`,
    orientation,
    mounting: flown ? 'flown' : 'stacked',
    bumper: flown ? r.pick(['M-BUMP+MBAR hole A', 'K2-BUMP', 'M-BUMP+MBAR inv Hole B']) : null,
    motors,
    pickups:
      motors === null
        ? []
        : Array.from({ length: motors }, (_, i) => ({
            which: i === 0 ? ('front' as const) : ('rear' as const),
            position: r.int(0, 20),
            at: pt(),
          })),
    position: pt(),
    site: cabinets[0]?.site ?? 0,
    azimuth: r.int(-90, 90),
    dimensions: { x: 0.75, y: round(r.int(50, 150) / 100, 2), z: round(r.int(10, 500) / 100, 2) },
    bottomElevation: round(r.int(0, 900) / 100, 2),
    topSite: cabinets[0]?.site ?? 0,
    bottomSite: cabinets[cabinets.length - 1]?.site ?? 0,
    weights: {
      total: round(r.int(100, 90000) / 100, 1),
      enclosures: r.chance(0.6) ? round(r.int(100, 80000) / 100, 1) : null,
      frontMotorLoad: motors ? round(r.int(100, 50000) / 100, 1) : null,
      rearMotorLoad: motors === 2 ? round(r.int(100, 50000) / 100, 1) : null,
    },
    cabinets,
    warnings: r.chance(0.4)
      ? [{ severity: r.pick(['WARNING', 'CAUTION']), title: 'Tipping hazard', message: 'Secure the array to the ground.' }]
      : [],
  };
}

describe('random reports', () => {
  for (let seed = 1; seed <= 300; seed++) {
    it(`seed ${seed} reads back exactly`, () => {
      const r = rng(seed);
      const sources = Array.from({ length: r.int(1, 6) }, (_, i) => randomSource(r, i + 1));
      const items = renderReport(DOCUMENT, sources, r.int(12, 60));
      const result = parseSoundvision(items);
      expect(result.problems).toEqual([]);
      expect(result.report.sources).toEqual(sources);
      expect(result.report.document).toEqual(DOCUMENT);
    });
  }

  it('reads the fixations of report E back exactly after they are drawn again', () => {
    const { report } = parseSoundvision(loadItems('e'));
    const fills = report.sources.filter((x) => x.fixations !== undefined).slice(0, 3).map((x) => ({ ...x, groups: [] }));
    const result = parseSoundvision(renderReport(DOCUMENT, fills));
    expect(result.problems).toEqual([]);
    expect(result.report.sources).toEqual(fills);
  });

  it('does put tables across page breaks', () => {
    const r = rng(7);
    const sources = Array.from({ length: 4 }, (_, i) => randomSource(r, i + 1));
    const pages = new Set(renderReport(DOCUMENT, sources, 15).map((i) => i.page));
    expect(pages.size).toBeGreaterThan(3);
  });

  it('gives the same answer however the items are ordered', () => {
    const r = rng(99);
    const sources = Array.from({ length: 4 }, (_, i) => randomSource(r, i + 1));
    const items = renderReport(DOCUMENT, sources);
    expect(parseSoundvision([...items].reverse())).toEqual(parseSoundvision(items));
  });
});
