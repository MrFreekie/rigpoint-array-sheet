// A ground stack laid out in rows, labelled "R2 #1" and "R1 #1" as Soundvision prints it. Built from the anonymised sample D
// (whose stacks are laid out in columns) with the labels turned into rows, drawn as a report and read back.

import { describe, expect, it } from 'vitest';
import { autoBreaks, cartRows, defaultCartSizes, sizeFor } from '../engine/carts';
import { compareReports } from '../engine/compare';
import { parseSoundvision } from '../engine/parse';
import { findMirrors } from '../engine/symmetry';
import { enclosureLabel, type ArraySource } from '../engine/types';
import { parseFixture } from '../testing/fixtures';
import { renderReport, type RenderedSource } from '../testing/render-report';
import { newDoc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { estimateWidth, layoutCardImage, type DrawOp } from './array-image';
import { cardContent, CARD_TABLE_WIDTHS_MM } from './card-content';
import { layoutPocketCard } from './pdf-layout';

const ctx = { show: 'Main stage', venue: 'Grand Hall', status: 'issued' as const, revision: 'B', zAxisZero: 'Arena floor' };
const base = parseFixture('d').report;

/** Sample D with the left stack in two rows, R2 #1 above R1 #1, and the right stack in one row of two, R1 #1 beside R1 #2. */
function inRows(): ArraySource[] {
  const sources = structuredClone(base.sources);
  const left = sources.find((s) => s.name === 'SB28 L')!;
  const right = sources.find((s) => s.name === 'SB28 R')!;
  const [c1, c2] = left.cabinets as [ArraySource['cabinets'][number], ArraySource['cabinets'][number]];
  const plain = (c: ArraySource['cabinets'][number]) => {
    const rest = { ...c };
    delete rest.column;
    return rest;
  };
  left.cabinets = [{ ...plain(c1), number: 1, row: 2 }, { ...plain(c2), number: 1, row: 1 }];
  right.cabinets = [{ ...plain(c1), number: 1, row: 1 }, { ...plain(c2), number: 2, row: 1 }];
  return sources;
}

const read = (sources: ArraySource[]) => parseSoundvision(renderReport(base.document, sources as RenderedSource[]));
const texts = (ops: DrawOp[]) => ops.filter((o): o is Extract<DrawOp, { op: 'text' }> => o.op === 'text').map((o) => o.text);

describe('a stack laid out in rows', () => {
  const result = read(inRows());
  const doc = newDoc(result, 'rows.pdf');
  const entry = (name: string) => sheetModel(doc, true).entries.find((e) => e.column.name === name)!;

  it('reads with no problems and keeps each row as printed', () => {
    expect(result.problems).toEqual([]);
    const left = result.report.sources.find((s) => s.name === 'SB28 L')!;
    const right = result.report.sources.find((s) => s.name === 'SB28 R')!;
    expect(left.cabinets.map(enclosureLabel)).toEqual(['R2 #1', 'R1 #1']);
    expect(right.cabinets.map(enclosureLabel)).toEqual(['R1 #1', 'R1 #2']);
    expect(left.cabinets.every((c) => c.column === undefined)).toBe(true);
  });

  it('heads the first card column Row # and prints the labels as they are', () => {
    const c = cardContent(entry('SB28 L'), ctx);
    expect(c.columns).toEqual(['Row #', 'Type', 'Feeder', 'Way']);
    expect(c.rows.map((r) => r[0])).toEqual(['R2 #1', 'R1 #1']);
    expect(cardContent(entry('SB28 R'), ctx).rows.map((r) => r[0])).toEqual(['R1 #1', 'R1 #2']);
    // A plain array keeps #, and a stack in columns keeps Col #.
    expect(cardContent(entry('X12 L'), ctx).columns[0]).toBe('#');
  });

  it('draws the label in the PDF card and the image, and the longest labels still fit their column', () => {
    const c = cardContent(entry('SB28 L'), ctx);
    const pdf = layoutPocketCard(c, estimateWidth);
    const pdfText = pdf.ops.filter((o) => o.op === 'text').map((o) => (o as { text: string }).text);
    expect(pdfText).toContain('Row #');
    expect(pdfText).toContain('R2 #1');
    expect(pdfText).toContain('R1 #1');
    const image = texts(layoutCardImage(c, { footer: 'footer', draft: false }).ops);
    expect(image).toContain('Row #');
    expect(image).toContain('R2 #1');
    // "R12 #24" in Helvetica Bold 7 pt, with the cell padding, fits the 12 mm column.
    expect(estimateWidth('R12 #24', 7, true) + 2).toBeLessThan((CARD_TABLE_WIDTHS_MM['Row #'] ?? 0) * (72 / 25.4));
  });

  it('does not cut a cart where the row changes, only where the type does', () => {
    const rows = cartRows(result.report.sources.find((s) => s.name === 'SB28 L')!.cabinets);
    expect(rows.every((r) => r.column === null)).toBe(true);
    expect(autoBreaks(rows, (t) => sizeFor(defaultCartSizes(), t), 'stacked')).toEqual([]);
  });

  it('pairs two stacks only when their rows match', () => {
    const sources = inRows();
    const left = sources.find((s) => s.name === 'SB28 L')!;
    const right = sources.find((s) => s.name === 'SB28 R')!;
    const mirrored = (a: ArraySource, b: ArraySource) => [...findMirrors([a, b])].length > 0;
    // Same rows, mirrored positions: the pair is found.
    const twin = structuredClone(left);
    twin.name = 'SB28 L copy';
    twin.position = twin.position && { ...twin.position, x: -twin.position.x };
    twin.azimuth = twin.azimuth === null ? null : -twin.azimuth;
    expect(mirrored(left, twin)).toBe(true);
    twin.cabinets[0]!.row = 3;
    expect(mirrored(left, twin)).toBe(false);
    expect(right.cabinets[0]?.row).toBe(1);
  });

  it('counts a changed row as a change when a new report is compared', () => {
    const next = structuredClone(result.report);
    next.sources.find((s) => s.name === 'SB28 L')!.cabinets[1]!.row = 3;
    const changes = compareReports(result.report, next);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.map((c) => c.what)).toContain('Enclosure R1 #1');
  });
});
