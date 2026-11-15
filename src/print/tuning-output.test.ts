// The tuning sheet in its two outputs, and the proof that it stays out of the others.

import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { suggestedTuningName } from '../files/file-name';
import { readPdfItems } from '../files/pdf-items';
import { parseFixture } from '../testing/fixtures';
import { newDoc, type Doc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { tuningRows, TUNING_FOOTNOTE } from '../ui/tuning-rows';
import { estimateWidth, layoutCardImage, type DrawOp } from './array-image';
import { cardContent } from './card-content';
import { CREDIT_TEXT, printFooter } from './footer';
import { panelHeader } from './panel-header';
import { renderPdf } from './pdf-export';
import { layoutTuningPages } from './tuning-layout';
import { renderTuningPdf } from './tuning-pdf';

const FOOTER = printFooter({ appVersion: '0.1.0', soundvisionVersion: '2026.3.1', fileName: null, defaultName: 'Main stage.arraysheet.json', dirty: true, printedAt: new Date(2026, 9, 22, 9, 5), verb: 'Exported' });

function sampleDoc(name: 'a' | 'e' = 'a'): Doc {
  const doc = newDoc(parseFixture(name), `${name}.pdf`);
  doc.job = { show: 'Main stage', venue: 'Grand Hall', engineer: 'Sam', company: 'Acme Audio', zAxisZero: 'Arena floor', defaultOffset: '', origin: 'DSE', sideLabels: true, gridM: 10, notes: '', showDate: '' };
  return doc;
}

const texts = (ops: DrawOp[]) => ops.flatMap((o) => (o.op === 'text' ? [o.text] : []));
const geometry = { width: 1000, height: null, font: 13, margin: 24 };

describe('layoutTuningPages', () => {
  const doc = sampleDoc();
  const input = { header: panelHeader(doc), rows: tuningRows(doc), footer: (n: number, total: number) => `${FOOTER} · Page ${n} of ${total}` };

  it('is one page as tall as the table needs when there is no page height, with the title, the figures, the footnote, the footer and the credit', () => {
    const pages = layoutTuningPages(input, estimateWidth, geometry);
    expect(pages).toHaveLength(1);
    const all = texts(pages[0]!.ops);
    expect(all).toEqual(expect.arrayContaining(['Tuning sheet', 'Main stage · Grand Hall', 'Array', 'Delay', 'Gain', 'Autofilter', 'LF Contour', 'Zoom']));
    expect(all).toEqual(expect.arrayContaining(['KARA II L Main', '180 Hz, 2 dB', '4.17 ms', 'SUBS: 4 ms', 'SUBS: -2 dB', TUNING_FOOTNOTE, CREDIT_TEXT]));
    expect(all.some((t) => t.includes('Page 1 of 1'))).toBe(true);
  });

  it('holds a row for every array that is not deleted, and nothing from the FIR or air lines', () => {
    const all = texts(layoutTuningPages(input, estimateWidth, geometry)[0]!.ops);
    for (const r of input.rows) expect(all).toContain(r.cells[0]![0]!.text);
    expect(all.join(' ')).not.toMatch(/FIR|Air compensation/);
  });

  it('runs onto more pages when a page height is given, repeating the heading row and numbering the pages', () => {
    const many = { ...input, rows: [...input.rows, ...input.rows, ...input.rows] };
    const pages = layoutTuningPages(many, estimateWidth, { width: 842, height: 595, font: 9, margin: 28 });
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((p, n) => {
      expect(p.height).toBe(595);
      expect(texts(p.ops)).toEqual(expect.arrayContaining(['Array', 'LF Contour']));
      expect(texts(p.ops).some((t) => t.includes(`Page ${n + 1} of ${pages.length}`))).toBe(true);
    });
    expect(texts(pages[pages.length - 1]!.ops)).toContain(TUNING_FOOTNOTE);
    expect(texts(pages[0]!.ops)).not.toContain(TUNING_FOOTNOTE);
  });

  it('keeps every cell inside the page, wrapping a long autofilter line', () => {
    const rows = structuredClone(input.rows).slice(0, 2);
    rows[0]!.cells[3] = [{ text: 'Reduced latency (Disabled LF filters) and a good many more words than fit', small: false }];
    const page = layoutTuningPages({ ...input, rows }, estimateWidth, { width: 600, height: null, font: 12, margin: 20 })[0]!;
    for (const o of page.ops) if (o.op === 'text' && o.align === 'left') expect(o.x + estimateWidth(o.text, o.size, o.bold)).toBeLessThanOrEqual(600);
  });
});

describe('a table wider than the page', () => {
  const NAME = 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDE'.slice(0, 55);
  const line = (text: string, small = false) => ({ text, small });
  const row = {
    index: 0,
    cells: [
      [line('KARA II L Main')],
      [line('4.17 ms'), line(`${NAME}: 6 ms`, true)],
      [line('3 dB'), line(`${NAME}: -4 dB`, true)],
      [line('Reduced latency (Disabled LF filters)')],
      [line('180 Hz, 2 dB')],
      [line('1.1')],
    ],
  };
  const header = { status: 'Draft', title: 'Show', details: '' };
  const page = layoutTuningPages({ header, rows: [row], footer: () => 'footer' }, estimateWidth, { width: 640, height: null, font: 9, margin: 28 })[0]!;
  /** The lines under a heading, from the column that starts where the heading does. */
  const column = (heading: string) => {
    const x = page.ops.flatMap((o) => (o.op === 'text' && o.text === heading ? [Math.round(o.x)] : []))[0];
    return page.ops.flatMap((o) => (o.op === 'text' && Math.round(o.x) === x && o.text !== heading ? [o.text] : []));
  };

  it('never cuts a figure: the name of a group wraps and its figure stays whole on the last line', () => {
    expect(column('Delay')).toEqual(['4.17 ms', 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGH', 'IJKLMNOPQRSTUVWXYZABC: 6 ms']);
    expect(column('Gain')).toEqual(['3 dB', 'ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGH', 'IJKLMNOPQRSTUVWXYZABC: -4 dB']);
  });

  it('keeps the other figures on one line and whole, with no ellipsis anywhere', () => {
    const all = texts(page.ops);
    expect(all).toEqual(expect.arrayContaining(['4.17 ms', '3 dB', '180 Hz, 2 dB', '1.1']));
    expect(all.join(' ')).not.toContain('…');
  });

  it('lets the Array and Autofilter columns wrap instead', () => {
    expect(column('Array')).toEqual(['KARA II L', 'Main']);
    expect(column('Autofilter')).toEqual(['Reduced latency', '(Disabled LF filters)']);
  });

  it('keeps every line inside the page', () => {
    for (const o of page.ops) if (o.op === 'text' && o.align === 'left') expect(o.x + estimateWidth(o.text, o.size, o.bold)).toBeLessThanOrEqual(640);
  });

  it('measures the Array column in bold, the weight it is drawn in', () => {
    const calls: [string, boolean][] = [];
    layoutTuningPages({ header, rows: [row], footer: () => 'footer' }, (t, size, bold) => (calls.push([t, bold]), estimateWidth(t, size, bold)), { width: 640, height: null, font: 9, margin: 28 });
    expect(calls).toContainEqual(['KARA II L Main', true]);
    expect(calls).not.toContainEqual(['KARA II L Main', false]);
  });
});

describe('renderTuningPdf', () => {
  it('is a landscape A4 PDF, read back with the show, status, the figures, the footnote and the credit line', async () => {
    const doc = sampleDoc();
    const bytes = await renderTuningPdf({ doc, footer: FOOTER, checks: 0 });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const loaded = await PDFDocument.load(bytes.slice());
    const size = loaded.getPage(0).getSize();
    expect(size.width).toBeGreaterThan(size.height);
    const items = await readPdfItems(bytes.slice());
    const text = items.map((i) => i.text).join(' ');
    expect(text).toContain('Tuning sheet');
    expect(text).toContain('Main stage');
    expect(text).toContain('Grand Hall');
    expect(text).toContain('DRAFT');
    expect(text).toContain('KARA II L Main');
    expect(text).toContain('180 Hz, 2 dB');
    expect(text).toContain('SUBS: 4 ms');
    expect(text).toContain(TUNING_FOOTNOTE);
    expect(text).toContain(CREDIT_TEXT);
    expect(text).toContain('Page 1 of 1');
  });

  it('repeats the heading row on each page when the table runs past one', async () => {
    const doc = sampleDoc();
    const sources = doc.result.report.sources;
    doc.result = { ...doc.result, report: { ...doc.result.report, sources: [...sources, ...sources, ...sources, ...sources] } };
    const items = await readPdfItems((await renderTuningPdf({ doc, footer: FOOTER, checks: 2 })).slice());
    const pages = Math.max(...items.map((i) => i.page));
    expect(pages).toBeGreaterThan(1);
    for (let p = 1; p <= pages; p++) {
      const text = items.filter((i) => i.page === p).map((i) => i.text).join(' ');
      expect(text).toContain('LF Contour');
      expect(text).toContain('2 to check against the PDF');
      expect(text).toContain(`Page ${p} of ${pages}`);
    }
  });
});

describe('the tuning sheet stays out of the other outputs', () => {
  it('is not in the main PDF', async () => {
    const doc = sampleDoc();
    const bytes = await renderPdf({ doc, model: sheetModel(doc, false), footer: FOOTER, checks: 0 });
    const text = (await readPdfItems(bytes.slice())).map((i) => i.text).join(' ');
    expect(text).not.toContain('Tuning sheet');
    expect(text).not.toContain('LF Contour');
    expect(text).not.toContain('SUBS: 4 ms');
    expect(text).not.toContain(TUNING_FOOTNOTE);
  });

  it('is not on the cards or their images', () => {
    const doc = sampleDoc();
    const ctx = { show: 'Main stage', venue: 'Grand Hall', status: 'draft' as const, revision: '', zAxisZero: '' };
    for (const entry of sheetModel(doc, true).entries) {
      const content = cardContent(entry, ctx);
      const all = JSON.stringify(content) + texts(layoutCardImage(content, { footer: 'x', draft: false }).ops).join(' ');
      expect(all).not.toMatch(/Autofilter|LF Contour|Zoom|Tuning/);
    }
  });
});

describe('suggestedTuningName', () => {
  it('is the show, the revision and Tuning sheet', () => {
    expect(suggestedTuningName('Main stage', '', 'pdf')).toBe('Main stage - Tuning sheet.pdf');
    expect(suggestedTuningName('Main stage.xmlp', 'B', 'png')).toBe('Main stage - Rev B - Tuning sheet.png');
    expect(suggestedTuningName('a/b: c', '', 'pdf')).toBe('a b c - Tuning sheet.pdf');
  });
});
