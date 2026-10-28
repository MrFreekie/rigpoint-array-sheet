// An additional weight on the rigging plot, the rigging summary and the small print.

import { describe, expect, it } from 'vitest';
import { EXTRA_TABLE_COLUMNS, extraTableRows, extrasUsed, riggingRows, riggingWeights, riggingWeightsNote, weightTableColumns, weightTableRows } from '../engine/sheet';
import { parseFixture } from '../testing/fixtures';
import { NOT_STATED } from '../ui/format';
import { extraKgFor, sheetModel } from '../ui/sheet-model';
import { newDoc, withExtra } from '../ui/document';
import { estimateWidth, type DrawOp } from './array-image';
import { layoutRiggingPage } from './pdf-layout';
import { plotDxf } from './plot-dxf';
import { plotContent } from './plot-input';
import { layoutPlotPages, tableRow, type PlotOp } from './plot-layout';
import { qrMatrix } from './qr';
import { PLOT_EXTRA_WEIGHT_SENTENCE, PLOT_SMALL_PRINT, plotSmallPrint } from './small-print';

const plotTexts = (ops: PlotOp[]) => ops.flatMap((o) => (o.op === 'text' ? [o.text] : []));
const drawTexts = (ops: DrawOp[]) => ops.flatMap((o) => (o.op === 'text' ? [o.text] : []));

/** Fixture A with 10 kg typed on the pickup of the left main and 0.35 kg on the pickup of the left out hang. */
function typedDoc() {
  const doc = newDoc(parseFixture('a'), 'a.pdf');
  doc.job.origin = 'DSE';
  const left = doc.result.report.sources.findIndex((s) => s.name === 'KARA II L Main');
  const out = doc.result.report.sources.findIndex((s) => s.name === 'KARA II L Out');
  const pickup = (i: number) => doc.result.report.sources[i]!.pickups[0]!.which;
  return { doc: withExtra(withExtra(doc, left, pickup(left), '10'), out, pickup(out), '0.35'), left, out };
}

const plotOf = (doc: ReturnType<typeof newDoc>) => {
  const content = plotContent(doc, sheetModel(doc, false))!;
  return { content, pages: layoutPlotPages({ ...content, footer: () => '' }, estimateWidth) };
};

describe('the rigging plot with an additional weight', () => {
  it('shows the pickup load and the array total with the weight added, in whole hundredths', () => {
    const { doc } = typedDoc();
    const { content, pages } = plotOf(doc);
    const t = plotTexts(pages[0]!.ops);
    expect(t.some((x) => x.endsWith('424.2 kg'))).toBe(true);
    expect(t).toContain('Total 424.2 kg');
    expect(t.some((x) => x.endsWith('184.65 kg'))).toBe(true);
    expect(t).toContain('Total 184.65 kg');
    expect(t.join(' ')).not.toMatch(/\d\.\d{3,}/);
    const left = content.points.find((p) => p.source === 'KARA II L Main')!;
    expect(left.load).toBe(424.2);
    expect(tableRow(left, content.symbolValues)).toContain('424.2');
  });

  it('leaves an array with no additional weight exactly as the report states it', () => {
    const base = newDoc(parseFixture('c'), 'c.pdf');
    const k1 = base.result.report.sources.findIndex((s) => s.name === 'K1 1 Left');
    const typed = withExtra(base, k1, base.result.report.sources[k1]!.pickups[0]!.which, '25');
    const plain = plotContent(base, sheetModel(base, false))!;
    const changed = plotContent(typed, sheetModel(typed, false))!;
    const name = 'K2 Left';
    const was = plain.points.filter((p) => p.source === name);
    expect(was.length).toBeGreaterThan(0);
    expect(changed.points.filter((p) => p.source === name)).toEqual(was);
    expect(changed.arrays.find((x) => x.name === name)?.totalWeight).toBe(plain.arrays.find((x) => x.name === name)?.totalWeight);
    expect(changed.arrays.find((x) => x.name === 'K1 1 Left')?.totalWeight).not.toBe(plain.arrays.find((x) => x.name === 'K1 1 Left')?.totalWeight);
  });

  it('does not change anything when no weight is typed, and does not add the sentence', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    const { content, pages } = plotOf(doc);
    expect(content.additionalWeight).toBe(false);
    expect(plotTexts(pages[0]!.ops).join(' ')).not.toContain(PLOT_EXTRA_WEIGHT_SENTENCE);
  });

  it('adds one sentence to the approved small print when a weight is in use, and leaves the approved words as they were', () => {
    expect(plotSmallPrint(false)).toBe(PLOT_SMALL_PRINT);
    expect(plotSmallPrint(true)).toBe(`${PLOT_SMALL_PRINT} ${PLOT_EXTRA_WEIGHT_SENTENCE}`);
    expect(PLOT_EXTRA_WEIGHT_SENTENCE).toBe('Loads include any additional weight typed in the app.');
    const { doc } = typedDoc();
    const { content, pages } = plotOf(doc);
    expect(content.additionalWeight).toBe(true);
    expect(plotTexts(pages[0]!.ops).join(' ')).toContain('Loads include any additional weight');
  });

  it('shows the same loads and the sentence in the DXF', () => {
    const { doc } = typedDoc();
    const { content } = plotOf(doc);
    const text = plotDxf({ ...content, footer: () => '' }, estimateWidth)!;
    expect(text).toContain('424.2 kg');
    expect(text).toContain('Total 424.2 kg');
    expect(text).toContain('Loads include any additional weight');
    const none = plotDxf({ ...plotOf(newDoc(parseFixture('a'), 'a.pdf')).content, footer: () => '' }, estimateWidth)!;
    expect(none).not.toContain('additional weight');
  });

  it('leaves a pickup whose load the report does not state without one', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    const i = doc.result.report.sources.findIndex((s) => s.name === 'KARA II L Main');
    doc.result.report.sources[i]!.weights.frontMotorLoad = null;
    doc.result.report.sources[i]!.weights.rearMotorLoad = null;
    const typed = withExtra(doc, i, doc.result.report.sources[i]!.pickups[0]!.which, '5');
    const p = plotOf(typed).content.points.find((x) => x.source === 'KARA II L Main')!;
    expect(p.load).toBeNull();
  });
});

describe('the rigging summary with an additional weight', () => {
  const sources = () => parseFixture('a').report.sources;

  it('is as before when no weight is typed, apart from the total weight of each array as its own item', () => {
    const rows = riggingRows(sources());
    expect(extrasUsed(rows)).toBe(false);
    const weights = riggingWeights(sources());
    expect(weights.length).toBeGreaterThan(0);
    expect(weightTableColumns(false)).toEqual(['Array', 'Total array weight (kg)']);
    expect(weightTableRows(weights, false, NOT_STATED)[0]).toEqual([weights[0]!.source, String(weights[0]!.total)]);
    expect(riggingWeightsNote(false)).toBe('Total array weight is the figure the report states.');
  });

  it('lists each weight typed as its own line, with the report load, the weight and the two added together', () => {
    const { doc } = typedDoc();
    const model = sheetModel(doc, false);
    const rows = riggingRows(model.sources, model.live, extraKgFor(doc, model));
    expect(extrasUsed(rows)).toBe(true);
    const lines = extraTableRows(rows, NOT_STATED);
    expect(EXTRA_TABLE_COLUMNS).toEqual(['Array', 'Pickup', 'Report load (kg)', 'Additional (kg)', 'Pickup total (kg)']);
    expect(lines).toContainEqual(['KARA II L Main', 'Single', '414.2', '10', '424.2']);
    // The mirror image that the card stands for takes the same weight.
    expect(lines).toContainEqual(['KARA II R Main', 'Single', '414.2', '10', '424.2']);
    expect(lines).toContainEqual(['KARA II L Out', 'Single', '184.3', '0.35', '184.65']);
    // The pickup table still holds the report's own load.
    expect(rows.find((r) => r.source === 'KARA II L Main')?.load).toBe(414.2);
  });

  it('shows the total weight of the array as its own item, then the additional weight and what the pickups make together', () => {
    const { doc } = typedDoc();
    const model = sheetModel(doc, false);
    const weights = riggingWeights(model.sources, model.live, extraKgFor(doc, model));
    const lines = weightTableRows(weights, true, NOT_STATED);
    expect(weightTableColumns(true)).toEqual(['Array', 'Total array weight (kg)', 'Additional weight (kg)', 'Pickups with additional (kg)']);
    expect(lines).toContainEqual(['KARA II L Main', '414.2', '10', '424.2']);
    expect(lines).toContainEqual(['KARA II L Out', '184.3', '0.35', '184.65']);
    // An array with nothing typed shows its total and a blank sum: a weight never changes the total the report states.
    const base = newDoc(parseFixture('c'), 'c.pdf');
    const k1 = base.result.report.sources.findIndex((s) => s.name === 'K1 1 Left');
    const typed = withExtra(base, k1, base.result.report.sources[k1]!.pickups[0]!.which, '25');
    const m = sheetModel(typed, false);
    const w = riggingWeights(m.sources, m.live, extraKgFor(typed, m));
    const plain = w.find((x) => x.source === 'K2 Left')!;
    expect(plain.extra).toBeNull();
    expect(weightTableRows(w, true, NOT_STATED).find((r) => r[0] === 'K2 Left')).toEqual(['K2 Left', String(plain.total), '0', '']);
    expect(riggingWeightsNote(true)).toContain('typed in the app');
  });

  it('puts both tables, their headings and the note on the page, and nothing about weights typed when none is', () => {
    const { doc } = typedDoc();
    const model = sheetModel(doc, false);
    const extraOf = extraKgFor(doc, model);
    const input = (rows: ReturnType<typeof riggingRows>, weights: ReturnType<typeof riggingWeights>) => ({
      rows,
      weights,
      fixations: [],
      subtitle: '',
      notes: '',
      qr: qrMatrix('https://example.com/'),
      qrUrl: 'https://example.com/',
    });
    const typed = drawTexts(layoutRiggingPage(input(riggingRows(model.sources, model.live, extraOf), riggingWeights(model.sources, model.live, extraOf)), estimateWidth).ops);
    for (const t of ['Additional weight, typed in the app', 'Array weights', 'Report load (kg)', 'Additional (kg)', 'Pickup total (kg)', 'Total array weight (kg)', 'Additional weight (kg)', '424.2', '184.65']) expect(typed).toContain(t);
    const plain = drawTexts(layoutRiggingPage(input(riggingRows(sources()), riggingWeights(sources())), estimateWidth).ops);
    expect(plain).toContain('Array weights');
    expect(plain).toContain('Total array weight (kg)');
    expect(plain).not.toContain('Additional weight, typed in the app');
    expect(plain).not.toContain('Additional (kg)');
  });
});
