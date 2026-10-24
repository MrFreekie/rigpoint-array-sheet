// A hang can start with rigid enclosures (an SB18 block) that print no angle, followed by a splayed
// array whose first row prints an angle but keeps the site above. Soundvision prints that as normal, so
// it must read without a check, while a real misreading in a flown table must still be caught.

import { describe, expect, it } from 'vitest';
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

const cabinet = (number: number, type: string, angle: number | null, site: number, top: number, bottom: number, panflex: string | null): Cabinet => ({
  number,
  type,
  angle,
  site,
  topZ: top,
  bottomZ: bottom,
  panflex,
});

function source(cabinets: Cabinet[]): RenderedSource {
  return {
    number: 1,
    name: 'Array 1',
    groups: [],
    configuration: 'vertical, flown array',
    orientation: 'vertical',
    mounting: 'flown',
    bumper: 'M-BUMP+MBAR hole A',
    motors: 1,
    pickups: [{ which: 'front', position: 5, at: { x: 4.88, y: 0.42, z: 7.06 } }],
    position: { x: 4.88, y: 0.71, z: 6.93 },
    site: 2.1,
    azimuth: 0,
    dimensions: { x: 0.75, y: 0.97, z: 3.5 },
    bottomElevation: 3.6,
    topSite: cabinets[0]?.site ?? 0,
    bottomSite: cabinets[cabinets.length - 1]?.site ?? 0,
    weights: { total: 392, enclosures: 361, frontMotorLoad: 392, rearMotorLoad: null },
    cabinets,
    warnings: [],
  };
}

const read = (cabinets: Cabinet[]) => parseSoundvision(renderReport(DOCUMENT, [source(cabinets)]));

// Two rigid SB18 rows, then KARA II rows whose first row prints angle 5 but keeps the site above.
const rigidThenSplayed = (): Cabinet[] => [
  cabinet(1, 'SB18', null, 2.1, 6.93, 6.39, null),
  cabinet(2, 'SB18', null, 2.1, 6.39, 5.85, null),
  cabinet(3, 'KARA II', 5, 2.1, 5.76, 5.51, '35/35'),
  cabinet(4, 'KARA II', 1, 1.1, 5.51, 5.26, '35/35'),
  cabinet(5, 'KARA II', 4, -2.9, 5.26, 5.01, '35/35'),
];

describe('a hang of rigid enclosures above a splayed array', () => {
  it('reads without a check, and keeps the figures that are there', () => {
    const r = read(rigidThenSplayed());
    expect(r.problems).toEqual([]);
    const rows = r.report.sources[0]?.cabinets ?? [];
    expect(rows.map((c) => [c.number, c.type, c.angle, c.site])).toEqual([
      [1, 'SB18', null, 2.1],
      [2, 'SB18', null, 2.1],
      [3, 'KARA II', 5, 2.1],
      [4, 'KARA II', 1, 1.1],
      [5, 'KARA II', 4, -2.9],
    ]);
  });

  it('still asks for a missing angle when the site moves', () => {
    const rows = rigidThenSplayed();
    rows[3] = cabinet(4, 'KARA II', null, 1.1, 5.51, 5.26, '35/35');
    const messages = read(rows).problems.map((p) => p.message);
    expect(messages.some((m) => m.startsWith('Enclosure #4, angle: nothing was found'))).toBe(true);
  });

  it('still catches a site that does not follow the angle inside the same type', () => {
    const rows = rigidThenSplayed();
    rows[3] = cabinet(4, 'KARA II', 1, 0.6, 5.51, 5.26, '35/35');
    const messages = read(rows).problems.map((p) => p.message);
    expect(messages.some((m) => m.startsWith('Enclosure #4: its site angle does not equal the one above'))).toBe(true);
  });

  it('still catches an angle that does not follow where the type changes and the site moves', () => {
    const rows = rigidThenSplayed();
    rows[2] = cabinet(3, 'KARA II', 5, 0.1, 5.76, 5.51, '35/35');
    const messages = read(rows).problems.map((p) => p.message);
    expect(messages.some((m) => m.startsWith('Enclosure #3: its site angle does not equal the one above'))).toBe(true);
  });

  it('still catches a missing angle on a row of the same type that moved', () => {
    const rows = [cabinet(1, 'KARA II', 0, 2.1, 6.93, 6.68, '35/35'), cabinet(2, 'KARA II', null, 1.1, 6.68, 6.43, '35/35')];
    const messages = read(rows).problems.map((p) => p.message);
    expect(messages.some((m) => m.startsWith('Enclosure #2, angle: nothing was found'))).toBe(true);
  });
});
