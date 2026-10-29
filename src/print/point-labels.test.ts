// The Point column of the rigging summary: the rigging point numbers of the plot, blank for an array that is not on it.

import { describe, expect, it } from 'vitest';
import { riggingRows } from '../engine/sheet';
import { parseFixture } from '../testing/fixtures';
import { sheetModel } from '../ui/sheet-model';
import { newDoc, withOnPlot } from '../ui/document';
import { estimateWidth, type DrawOp } from './array-image';
import { RIGGING_PICKUP_COLUMNS, RIGGING_PICKUP_LEFT_COLUMNS, RIGGING_PICKUP_WIDTHS_MM, layoutRiggingPage } from './pdf-layout';
import { plotContent, pointLabelOf } from './plot-input';
import { qrMatrix } from './qr';

const rowsOf = (doc: ReturnType<typeof newDoc>) => {
  const model = sheetModel(doc, false);
  return { model, rows: riggingRows(model.sources, model.live, () => null, pointLabelOf(model)) };
};

describe('the Point column of the rigging summary', () => {
  it('starts the Rigging Points table with Point, and the widths add up to the 192 mm page', () => {
    expect(RIGGING_PICKUP_COLUMNS.slice(0, 3)).toEqual(['Point', 'Array', 'Pickup']);
    expect(RIGGING_PICKUP_WIDTHS_MM).toHaveLength(RIGGING_PICKUP_COLUMNS.length);
    expect(RIGGING_PICKUP_WIDTHS_MM.reduce((a, b) => a + b, 0)).toBe(192);
    expect(RIGGING_PICKUP_LEFT_COLUMNS).toEqual([1, 2]);
  });

  it.each(['a', 'c', 'e'] as const)('gives every pickup the number the plot gives it, on report %s', (name) => {
    const doc = newDoc(parseFixture(name), `${name}.pdf`);
    const { model, rows } = rowsOf(doc);
    const plot = plotContent(doc, model)!;
    const byPickup = new Map(plot.points.map((p) => [`${p.source}:${p.which}`, p.label]));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const which = r.location === 'Single' ? model.sources.find((s) => s.name === r.source)!.pickups[0]!.which : r.location === 'Front' ? 'front' : 'rear';
      expect(r.point).toBe(byPickup.get(`${r.source}:${which}`));
    }
    // Every number on the plot appears once on the summary, and nothing else is numbered.
    expect(rows.map((r) => r.point).filter(Boolean).sort()).toEqual(plot.points.map((p) => p.label).sort());
  });

  it('leaves the cell blank for an array that is not on the plot, and the others keep their numbers', () => {
    const base = newDoc(parseFixture('a'), 'a.pdf');
    const before = rowsOf(base).rows;
    const off = base.result.report.sources.findIndex((s) => s.name === 'KARA II L Main');
    const doc = withOnPlot(base, off, false);
    const { model, rows } = rowsOf(doc);
    const offRows = rows.filter((r) => r.source === 'KARA II L Main');
    expect(offRows.length).toBeGreaterThan(0);
    for (const r of offRows) expect(r.point).toBe('');
    // The card stands for its mirror image too, so the mirror image is off the plot with it. The numbers close up as on the plot.
    const plot = plotContent(doc, model)!;
    const onPlot = new Set(plot.points.map((p) => p.source));
    expect(onPlot.has('KARA II L Main')).toBe(false);
    for (const r of rows) expect(r.point === '').toBe(!onPlot.has(r.source));
    expect(rows.map((r) => r.point).filter(Boolean).sort()).toEqual(plot.points.map((p) => p.label).sort());
    expect(rows.filter((r) => r.point === '').length).toBeLessThan(before.length);
    expect(plot.points.length).toBeLessThan(plotContent(base, sheetModel(base, false))!.points.length);
  });

  it('numbers both arrays of a collapsed mirror pair, as the plot does', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    const { model, rows } = rowsOf(doc);
    const mirrored = model.entries.find((e) => e.mirrorIndex !== undefined)!;
    const names = [model.sources[mirrored.index]!.name, model.sources[mirrored.mirrorIndex!]!.name];
    for (const n of names) expect(rows.filter((r) => r.source === n).every((r) => /^PA\d+$/.test(r.point))).toBe(true);
  });

  it('prints the Rigging Points heading and a centred Point column in the PDF layout, with a blank cell left empty', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    const base = rowsOf(doc).rows;
    const rows = base.map((r, i) => (i === 0 ? { ...r, point: '' } : r));
    const laid = layoutRiggingPage({ rows, fixations: [], subtitle: '', notes: '', qr: qrMatrix('https://example.test/'), qrUrl: 'https://example.test/' }, estimateWidth);
    const texts = laid.ops.filter((o): o is Extract<DrawOp, { op: 'text' }> => o.op === 'text');
    expect(texts.some((o) => o.text === 'Rigging Points' && o.bold)).toBe(true);
    const head = texts.find((o) => o.text === 'Point')!;
    expect(head.align).toBe('center');
    const labels = texts.filter((o) => /^PA\d+$/.test(o.text));
    expect(labels.length).toBe(base.length - 1);
    for (const o of labels) expect(o.align).toBe('center');
    // The pickups with no number draw nothing in that cell, not a dash.
    expect(texts.filter((o) => o.text === '–').length).toBe(0);
    // Array stays left of the numbers, and the heading comes before the first header cell.
    const heading = texts.findIndex((o) => o.text === 'Rigging Points');
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(heading).toBeLessThan(texts.findIndex((o) => o.text === 'Point'));
  });
});
