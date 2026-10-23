// Builds the PDF and reads it back with the app's own PDF reader, so the tests see what a person would.

import { PDFArray, PDFDocument, decodePDFRawStream, type PDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { readPdfItems } from '../files/pdf-items';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withPrinted, type Doc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { printFooter } from './footer';
import { renderPdf } from './pdf-export';

const FOOTER = printFooter({
  appVersion: '0.1.0',
  soundvisionVersion: '2026.3.1',
  fileName: null,
  defaultName: 'Main stage.arraysheet.json',
  dirty: true,
  printedAt: new Date(2026, 9, 22, 9, 5),
  verb: 'Exported',
});

function sampleDoc(name: 'a' | 'b' = 'a'): Doc {
  const doc = newDoc(parseFixture(name), `${name}.pdf`);
  doc.job = { show: 'Main stage', venue: 'Grand Hall', engineer: 'Sam', company: 'Acme Audio', zAxisZero: 'Arena floor', defaultOffset: '' };
  return doc;
}

async function make(doc: Doc, showMirrors = false, checks = 0) {
  const bytes = await renderPdf({ doc, model: sheetModel(doc, showMirrors), footer: FOOTER, checks });
  // The reader takes over the buffer it is given, so give it a copy and keep the original.
  const items = await readPdfItems(bytes.slice());
  const pages = Math.max(...items.map((i) => i.page));
  const text = (page: number) => items.filter((i) => i.page === page).map((i) => i.text).join(' ');
  return { bytes, items, pages, text, all: items.map((i) => i.text).join(' ') };
}

/** Per page, the grey fold marks drawn: short solid ticks (long pages) and dashed lines (grid pages). */
async function foldMarks(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page) => {
    const contents = page.node.Contents();
    const streams = (contents instanceof PDFArray ? contents.asArray().map((r) => pdf.context.lookup(r)) : [contents]) as PDFRawStream[];
    const ops = streams.map((st) => new TextDecoder('latin1').decode(decodePDFRawStream(st).decode())).join('\n');
    const dash = [...ops.matchAll(/0\.47 0\.47 0\.47 RG\n0\.7 w\n(\[[^\]]*\]) 0 d/g)].map((m) => m[1]);
    return { ticks: dash.filter((d) => d === '[]').length, dashed: dash.filter((d) => d !== '[]').length };
  });
}

describe('renderPdf', () => {
  it('makes a real PDF', async () => {
    const { bytes } = await make(sampleDoc());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(5_000);
  });

  it('puts four arrays on a page and the rigging summary last: report A is four pages', async () => {
    const { pages, text } = await make(sampleDoc());
    expect(pages).toBe(4); // 9 arrays = 4 + 4 + 1, then the rigging page
    expect(text(1)).toContain('KARA II L Main');
    expect(text(1)).toContain('414.2 kg');
    expect(text(1)).toContain('SB28 L Rear');
    expect(text(2)).toContain('X8 2');
    expect(text(3)).toContain('X12 B L');
    expect(text(4)).toContain('Rigging summary');
    expect(text(4)).toContain('KARA II R Out');
  });

  it('report B is three pages', async () => {
    expect((await make(sampleDoc('b'))).pages).toBe(3);
  });

  it('says MIRRORED and the other array, with nothing else', async () => {
    const { all } = await make(sampleDoc());
    expect(all).toContain('MIRRORED: KARA II R Main');
    expect(all).not.toContain('exact left-right');
  });

  it('gives every pocket panel its own header and footer', async () => {
    const { text } = await make(sampleDoc());
    const page1 = text(1);
    expect(page1.match(/RIGPOINT ARRAY/g)).toHaveLength(4);
    expect(page1.match(/Main stage · Grand Hall/g)).toHaveLength(4);
    expect(page1.match(/Z-axis zero: Arena floor/g)).toHaveLength(4);
    expect(page1.match(/Page 1 of 4/g)?.length).toBeGreaterThanOrEqual(4);
    expect(page1).toContain('RigPoint Array 0.1.0 · Soundvision 2026.3.1');
    expect(page1).toContain('(unsaved changes)'.replace('unsaved changes', 'not saved'));
  });

  it('marks a draft on every panel, and only a draft', async () => {
    const draft = await make(sampleDoc());
    expect(draft.items.filter((i) => i.text === 'DRAFT').length).toBeGreaterThanOrEqual(10); // 9 panel watermarks and the rigging page
    const issued = sampleDoc();
    issued.status = 'issued';
    issued.revision = 'B';
    const done = await make(issued);
    expect(done.items.some((i) => i.text === 'DRAFT')).toBe(false);
    expect(done.all).toContain('ISSUED REV B');
  });

  it('prints only the arrays that are chosen, and only their pickups', async () => {
    let doc = sampleDoc();
    // Leave out the left main (and the right main it stands for), a sub pair and two fills: four cards remain.
    for (const i of [0, 4, 6, 8, 9]) doc = withPrinted(doc, i, false);
    const { pages, text, all } = await make(doc);
    expect(pages).toBe(2);
    expect(all).not.toContain('KARA II L Main');
    expect(text(1)).toContain('KARA II L Out');
    expect(text(1)).toContain('X12 B L');
    expect(text(2)).toContain('KARA II L Out');
    expect(text(2)).not.toContain('KARA II R Main');
  });

  it('has the QR address and the approved small print on the last page', async () => {
    const { text } = await make(sampleDoc());
    // The address is wrapped under the code, so join the pieces before looking for it.
    expect(text(4).replace(/ /g, '')).toContain('https://mrfreekie.github.io/rigpoint-array-sheet/');
    expect(text(4)).toContain('is provided as it is, without warranty');
    expect(text(4)).toContain('Soundvision and L-Acoustics are trademarks of their owners.');
  });

  it('adds the number of items to check to every footer', async () => {
    const { all } = await make(sampleDoc(), false, 3);
    expect(all).toContain('3 to check against the PDF');
  });

  it('copes with characters Helvetica does not have', async () => {
    const doc = sampleDoc();
    doc.job.show = 'Show Ω 日本';
    const { all, pages } = await make(doc);
    expect(pages).toBe(4);
    expect(all).toContain('Show ? ??');
  });

  /** Report A with its first array this many rows tall. That array no longer mirrors the right main, so the
   * last array is left out to keep nine on the sheet, unless the mirror is changed too. */
  function tallDoc(rows: Record<string, number>, dropLast = true): Doc {
    const doc = sampleDoc();
    const row = doc.result.report.sources[0]!.cabinets[0]!;
    for (const [name, n] of Object.entries(rows)) {
      const source = doc.result.report.sources.find((s) => s.name === name)!;
      source.cabinets = Array.from({ length: n }, (_, i) => ({ ...row, number: i + 1 }));
    }
    return dropLast ? withPrinted(doc, 9, false) : doc;
  }

  it('puts a 24-row array in a long column on the first page, ahead of the grid pages', async () => {
    const { pages, text } = await make(tallDoc({ 'KARA II L Main': 24 }));
    expect(pages).toBe(4); // one long page, two grid pages of four, then the rigging page
    expect(text(1).match(/KARA II L Main/g)).toHaveLength(1);
    expect(text(1).match(/RIGPOINT ARRAY/g)).toHaveLength(1);
    expect(text(1).match(/KARA II/g)?.length).toBeGreaterThanOrEqual(24);
    expect(text(2)).toContain('KARA II R Main');
    expect(text(2).match(/RIGPOINT ARRAY/g)).toHaveLength(4);
  });

  it('puts two 24-row arrays side by side on one long page, each with its own header and page number', async () => {
    const { pages, text } = await make(tallDoc({ 'KARA II L Main': 24, 'KARA II R Main': 24, 'KARA II L Out': 24, 'KARA II R Out': 24 }, false));
    expect(pages).toBe(4); // two long columns on one page, then grid pages of four and three, then the rigging page
    expect(text(1)).toContain('KARA II L Main');
    expect(text(1)).toContain('KARA II L Out');
    expect(text(1).match(/RIGPOINT ARRAY/g)).toHaveLength(2);
    expect(text(1).match(/Page 1 of 4/g)).toHaveLength(2);
    expect(text(2).match(/RIGPOINT ARRAY/g)).toHaveLength(4);
  });

  it('marks a long page with a DRAFT word per column and two fold ticks, and a grid page with the dashed cross', async () => {
    const { bytes, items, pages } = await make(tallDoc({ 'KARA II L Main': 24, 'KARA II R Main': 24, 'KARA II L Out': 24, 'KARA II R Out': 24 }, false));
    // The header of each column also says DRAFT, at the top of the page; the watermark sits lower, mid-column.
    expect(items.filter((i) => i.page === 1 && i.text === 'DRAFT' && i.y < 700)).toHaveLength(2);
    const marks = await foldMarks(bytes);
    expect(marks).toHaveLength(pages);
    expect(marks[0]).toEqual({ ticks: 2, dashed: 0 });
    expect(marks[1]).toEqual({ ticks: 0, dashed: 2 });
    expect(marks[2]).toEqual({ ticks: 0, dashed: 2 });
    expect(marks[pages - 1]).toEqual({ ticks: 0, dashed: 0 }); // the rigging page has no fold marks
  });

  it('puts a 48-row array in a long column too, so the page count is the same', async () => {
    const { pages, text } = await make(tallDoc({ 'KARA II L Main': 48 }));
    expect(pages).toBe(4);
    expect(text(1).match(/KARA II/g)?.length).toBeGreaterThanOrEqual(48);
  });

  it('with the mirrored arrays shown, prints all eighteen', async () => {
    const { pages, all } = await make(sampleDoc(), true);
    expect(pages).toBe(6); // 18 = 4 + 4 + 4 + 4 + 2, then rigging
    expect(all).toContain('KARA II R Main');
  });
});
