// A report can name the two pickups of an array left and right instead of front and rear, and print the position as a code
// such as EXT. The reader keeps that, the sheet says Left and Right wherever it shows a pickup, and mirrors pair left with right.
// The arrays here are invented.

import { describe, expect, it } from 'vitest';
import { importPdf } from '../files/import-pdf';
import { newDoc, withExtra } from '../files/doc';
import { cardContent, type CardContext } from '../print/card-content';
import { plotContent } from '../print/plot-input';
import { tableRow } from '../print/plot-layout';
import { makePdf, type PdfText } from '../testing/make-pdf';
import { renderReport, type RenderedSource } from '../testing/render-report';
import { extraKgFor, sheetModel } from '../ui/sheet-model';
import { parseSoundvision } from './parse';
import { riggingRows } from './sheet';
import { findMirrors, isMirror } from './symmetry';
import type { Cabinet, ReportDocument, TextItem } from './types';

const DOCUMENT: ReportDocument = {
  version: '2026.3.1',
  author: 'Example Author',
  date: '2026/10/21',
  fileName: 'Example Show.xmlp',
  distanceUnit: 'm',
  weightUnit: 'kg',
};

const row = (number: number, site: number, top: number, bottom: number): Cabinet => ({ number, type: 'KS28', angle: null, site, topZ: top, bottomZ: bottom, panflex: null });

/** A rigid hang of three enclosures with no Angles column, whose two pickups the report names left and right. */
function hang(number: number, name: string, over: Partial<RenderedSource> = {}): RenderedSource {
  return {
    number,
    name,
    groups: [],
    configuration: 'vertical, flown array',
    orientation: 'vertical',
    mounting: 'flown',
    bumper: 'EXT-BUMP',
    motors: 2,
    pickups: [
      { which: 'front', side: 'left', position: 'EXT', at: { x: 11.1, y: 5.25, z: 8.6 } },
      { which: 'rear', side: 'right', position: 'EXT', at: { x: 9.9, y: 5.25, z: 8.6 } },
    ],
    position: { x: 10.5, y: 5.1, z: 8.5 },
    site: 0,
    azimuth: 0,
    dimensions: { x: 1.2, y: 0.9, z: 1.6 },
    bottomElevation: 6.9,
    topSite: 0,
    bottomSite: 0,
    weights: { total: 650, enclosures: 600, frontMotorLoad: 320, rearMotorLoad: 330 },
    cabinets: [row(1, 0, 8.5, 8), row(2, 0, 8, 7.5), row(3, 0, 7.5, 7)],
    warnings: [],
    ...over,
  };
}

/** The same hang as seen in a mirror across the centre line: X and the left and right pickups change places. */
function mirrored(s: RenderedSource, number: number, name: string): RenderedSource {
  const [left, right] = s.pickups;
  return {
    ...s,
    number,
    name,
    pickups: [
      { which: 'front', side: 'left', position: 'EXT', at: { ...right!.at, x: -right!.at.x } },
      { which: 'rear', side: 'right', position: 'EXT', at: { ...left!.at, x: -left!.at.x } },
    ],
    position: { ...s.position!, x: -s.position!.x },
    weights: { ...s.weights, frontMotorLoad: s.weights.rearMotorLoad, rearMotorLoad: s.weights.frontMotorLoad },
  };
}

const pair = (): RenderedSource[] => {
  const a = hang(1, 'Hang A');
  return [a, mirrored(a, 2, 'Hang B')];
};

const read = (sources: RenderedSource[]) => parseSoundvision(renderReport(DOCUMENT, sources));

describe('a report that names its pickups left and right', () => {
  it('reads both pickups and both motor loads, with no check', () => {
    const r = read(pair());
    expect(r.problems).toEqual([]);
    const a = r.report.sources[0]!;
    expect(a.pickups).toEqual([
      { which: 'front', side: 'left', position: 'EXT', at: { x: 11.1, y: 5.25, z: 8.6 } },
      { which: 'rear', side: 'right', position: 'EXT', at: { x: 9.9, y: 5.25, z: 8.6 } },
    ]);
    expect(a.weights.frontMotorLoad).toBe(320);
    expect(a.weights.rearMotorLoad).toBe(330);
    expect(a.cabinets.every((c) => c.angle === null)).toBe(true);
    const b = r.report.sources[1]!;
    expect(b.pickups.map((p) => [p.side, p.at.x])).toEqual([['left', -9.9], ['right', -11.1]]);
    expect([b.weights.frontMotorLoad, b.weights.rearMotorLoad]).toEqual([330, 320]);
  });

  it('reads the same through a PDF', async () => {
    const pages: PdfText[][] = [];
    for (const i of renderReport(DOCUMENT, pair())) (pages[i.page - 1] ??= []).push({ x: i.x, y: i.y, text: i.text });
    const r = await importPdf(makePdf(pages));
    expect(r.problems).toEqual([]);
    expect(r.report.sources.map((s) => s.pickups.map((p) => `${p.side} ${p.position}`))).toEqual([['left EXT', 'right EXT'], ['left EXT', 'right EXT']]);
  });

  it('keeps a pickup named front or rear as it was, and still wants a number for it', () => {
    const plain = hang(1, 'Hang A', { pickups: [{ which: 'front', position: 5, at: { x: 1, y: 2, z: 3 } }, { which: 'rear', position: 6, at: { x: 1, y: 3, z: 3 } }] });
    const r = read([plain]);
    expect(r.problems).toEqual([]);
    expect(r.report.sources[0]?.pickups.map((p) => p.side)).toEqual([undefined, undefined]);
    expect('side' in (r.report.sources[0]?.pickups[0] ?? {})).toBe(false);
    const code: TextItem[] = renderReport(DOCUMENT, [hang(1, 'Hang A')]).map((i) => ({ ...i, text: i.text.replace('Front left pickup', 'Front pickup') }));
    const messages = parseSoundvision(code).problems.map((p) => p.message);
    expect(messages.some((m) => m.includes('Front pickup position (X; Y; Z, m): EXT'))).toBe(true);
  });

  it('does not read a rear left pickup, which no report has shown', () => {
    const items = renderReport(DOCUMENT, [hang(1, 'Hang A')]).map((i) => ({ ...i, text: i.text.replace('Front left pickup', 'Rear left pickup') }));
    const messages = parseSoundvision(items).problems.map((p) => p.message);
    expect(messages.some((m) => m.includes('Rear left pickup position'))).toBe(true);
  });

  it('asks for the Angle column when the rows do not share one site', () => {
    const moving = hang(1, 'Hang A', { cabinets: [row(1, 0, 8.5, 8), row(2, -3, 8, 7.5), row(3, -6, 7.5, 7)], topSite: 0, bottomSite: -6 });
    const messages = read([moving]).problems.map((p) => p.message);
    expect(messages).toEqual(['The enclosure table has no "Angle" column. Check this against the PDF.']);
  });
});

describe('mirrors of arrays whose pickups are named left and right', () => {
  it('pairs the left pickup of one with the right pickup of the other, and swaps their loads', () => {
    const { report } = read(pair());
    expect([...findMirrors(report.sources)]).toEqual([[0, 1]]);
  });

  it('does not pair arrays whose sides were not swapped, or whose loads did not swap', () => {
    const [a, b] = pair() as [RenderedSource, RenderedSource];
    const unswapped = { ...b, pickups: [{ ...b.pickups[0]!, at: b.pickups[1]!.at }, { ...b.pickups[1]!, at: b.pickups[0]!.at }] };
    expect(isMirror(read([a, unswapped]).report.sources[0]!, read([a, unswapped]).report.sources[1]!)).toBe(false);
    const sameLoads = { ...b, weights: a.weights };
    const sources = read([a, sameLoads]).report.sources;
    expect(isMirror(sources[0]!, sources[1]!)).toBe(false);
  });

  it('keeps the side from front to back', () => {
    const a = hang(1, 'Hang A');
    const back: RenderedSource = {
      ...a,
      number: 2,
      name: 'Hang B',
      pickups: a.pickups.map((p) => ({ ...p, at: { ...p.at, y: -p.at.y } })),
      position: { ...a.position!, y: -a.position!.y },
      azimuth: 180,
    };
    const sources = read([a, back]).report.sources;
    expect(isMirror(sources[0]!, sources[1]!, 'frontBack')).toBe(true);
    const swapped = read([a, { ...back, pickups: [{ ...back.pickups[1]!, side: 'left', which: 'front' }, { ...back.pickups[0]!, side: 'right', which: 'rear' }] }]).report.sources;
    expect(isMirror(swapped[0]!, swapped[1]!, 'frontBack')).toBe(false);
  });

  it('leaves a pickup with no side mirrored front to front, as before', () => {
    const plain = (s: RenderedSource): RenderedSource => ({ ...s, pickups: [{ which: 'front', position: 5, at: s.pickups[0]!.at }, { which: 'rear', position: 6, at: s.pickups[1]!.at }] });
    const [a, b] = pair() as [RenderedSource, RenderedSource];
    const sources = read([plain(a), { ...plain(b), pickups: [{ which: 'front', position: 5, at: b.pickups[1]!.at }, { which: 'rear', position: 6, at: b.pickups[0]!.at }], weights: a.weights }]).report.sources;
    expect(isMirror(sources[0]!, sources[1]!)).toBe(true);
  });
});

describe('Left and Right on the sheet', () => {
  const ctx: CardContext = { show: 'Main stage', venue: 'Grand Hall', status: 'issued', revision: '', zAxisZero: 'Arena floor' };
  const doc = newDoc(read(pair()), 'hangs.pdf');
  const model = sheetModel(doc, false);

  it('names them on the card, with their motor loads', () => {
    const entry = model.entries[0]!;
    expect(model.entries).toHaveLength(1);
    expect(entry.coversMirror).toBe('Hang B');
    const facts = cardContent(entry, ctx).facts;
    expect(facts).toContainEqual(['Left motor load', '320 kg']);
    expect(facts).toContainEqual(['Right motor load', '330 kg']);
    expect(facts).toContainEqual(['Pickups', 'Left EXT, Right EXT']);
    expect(facts.map(([label]) => label)).not.toContain('Front motor load');
  });

  it('names them in the rigging summary and the plot table', () => {
    expect(riggingRows(model.sources).map((r) => [r.source, r.location, r.pickupPosition, r.load])).toEqual([
      ['Hang A', 'Left', 'EXT', 320],
      ['Hang A', 'Right', 'EXT', 330],
      ['Hang B', 'Left', 'EXT', 330],
      ['Hang B', 'Right', 'EXT', 320],
    ]);
    const plot = plotContent(doc, model)!;
    expect(plot.points.map((p) => tableRow(p, plot.symbolValues)[2])).toEqual(['Left', 'Right', 'Left', 'Right']);
  });

  it('gives the mirror image the additional weight of the opposite pickup', () => {
    const typed = withExtra(doc, 0, 'front', '20');
    const extra = extraKgFor(typed, sheetModel(typed, false));
    expect([extra(0, 'front'), extra(0, 'rear')]).toEqual([20, null]);
    expect([extra(1, 'front'), extra(1, 'rear')]).toEqual([null, 20]);
  });
});
