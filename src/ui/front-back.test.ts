// A front-back mirror pair drawn as a Soundvision report would print it, read back, and shown on one card.

import { describe, expect, it } from 'vitest';
import { parseSoundvision } from '../engine/parse';
import type { ArraySource, ReportDocument } from '../engine/types';
import { cardContent } from '../print/card-content';
import { parseFixture } from '../testing/fixtures';
import { renderReport } from '../testing/render-report';
import { newDoc } from './document';
import { sheetModel } from './sheet-model';

const DOCUMENT: ReportDocument = { version: '2026.3.1', author: 'Example Author', date: '2026/10/21', fileName: 'Example Show.xmlp', distanceUnit: 'm', weightUnit: 'kg' };
const ctx = { show: 'Show', venue: 'Hall', status: 'draft' as const, revision: '', zAxisZero: '' };

function pair(): ArraySource[] {
  const front = structuredClone(parseFixture('a').report.sources.find((s) => s.name === 'KARA II L Out')!);
  front.name = 'Front hang';
  front.groups = [];
  const back: ArraySource = {
    ...structuredClone(front),
    name: 'Back hang',
    position: { ...front.position!, y: -front.position!.y },
    azimuth: 180 - front.azimuth!,
    pickups: front.pickups.map((p) => ({ ...p, at: { ...p.at, y: -p.at.y } })),
  };
  return [front, back];
}

describe('a front-back mirror pair read from a report', () => {
  const result = parseSoundvision(renderReport(DOCUMENT, pair()));
  const doc = newDoc(result, 'x.pdf');

  it('reads back without a problem', () => {
    expect(result.problems).toEqual([]);
    expect(result.report.sources.map((s) => s.name)).toEqual(['Front hang', 'Back hang']);
  });

  it('shows one card that says it is also mirrored with the other, the same words as a left-right pair', () => {
    const model = sheetModel(doc, false);
    expect(model.entries).toHaveLength(1);
    expect(model.mirrorPairs).toBe(1);
    expect(model.hidden).toEqual([{ name: 'Back hang', mirrorOf: 'Front hang' }]);
    expect(cardContent(model.entries[0]!, ctx).mirrorNote).toBe('Also mirrored with: Back hang');
  });

  it('shows both cards when mirrors are shown, the second naming the first, as for a left-right pair', () => {
    const model = sheetModel(doc, true);
    expect(model.entries.map((e) => cardContent(e, ctx).mirrorNote)).toEqual([null, 'Also mirrored with: Front hang']);
  });

  it('prints both arrays on the card sheet, so the hidden one is still on the plot', () => {
    const model = sheetModel(doc, false);
    expect([...model.printedSources].sort()).toEqual([0, 1]);
  });
});
