// Builds the PDF and reads it back with the app's own PDF reader, so the tests see what a person would.

import { PDFArray, PDFDocument, decodePDFRawStream, type PDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { readPdfItems } from '../files/pdf-items';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withOnPlot, withPlotPrinted, withPrinted, type Doc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { CREDIT_TEXT, printFooter } from './footer';
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

function sampleDoc(name: 'a' | 'b' | 'c' | 'e' = 'a'): Doc {
  const doc = newDoc(parseFixture(name), `${name}.pdf`);
  doc.job = { show: 'Main stage', venue: 'Grand Hall', engineer: 'Sam', company: 'Acme Audio', zAxisZero: 'Arena floor', defaultOffset: '', origin: 'DSE', sideLabels: true, notes: '', showDate: '' };
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

/** Per page, the grey fold marks drawn: dashed lines (one on a long page, two on a grid page) and any solid ones. */
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

  it('puts four arrays on a page, then the rigging plot, then the rigging summary last: report A is five pages', async () => {
    const { pages, text } = await make(sampleDoc());
    expect(pages).toBe(5); // 9 arrays = 4 + 4 + 1, then the plot, then the rigging page
    expect(text(1)).toContain('KARA II L Main');
    expect(text(1)).toContain('414.2 kg');
    expect(text(1)).toContain('SB28 L Rear');
    expect(text(2)).toContain('X8 2');
    expect(text(3)).toContain('X12 B L');
    expect(text(4)).toContain('Rigging plot');
    expect(text(5)).toContain('Rigging summary');
    expect(text(5)).toContain('KARA II R Out');
  });

  it('report B is four pages', async () => {
    expect((await make(sampleDoc('b'))).pages).toBe(4);
  });

  it('prints the show date, UK style, on every panel, the plot and the rigging page, and nothing when there is none', async () => {
    const doc = sampleDoc();
    doc.job = { ...doc.job, showDate: '2026-10-23' };
    const withDate = await make(doc);
    for (let p = 1; p <= withDate.pages; p++) expect(withDate.text(p), `page ${p}`).toContain('23/10/2026');
    const without = await make(sampleDoc());
    expect(without.all).not.toContain('23/10/2026');
    expect(without.pages).toBe(withDate.pages);
  });

  it('prints the show notes at the end of the rigging page content, under a Notes heading, and nothing when there are none', async () => {
    const doc = sampleDoc();
    doc.job = { ...doc.job, notes: 'Load in at 08:00.\nCall Sam first.' };
    const withNotes = await make(doc);
    const last = withNotes.text(withNotes.pages);
    expect(last).toContain('Rigging summary');
    expect(last).toContain('Notes');
    expect(last).not.toContain('Notes:');
    // After the tables, before the small print.
    expect(last.indexOf('Call Sam first.')).toBeGreaterThan(last.indexOf('Load (kg)'));
    expect(last.indexOf('Call Sam first.')).toBeLessThan(last.indexOf('is provided as it is'));
    expect(last).toContain('Load in at 08:00.');
    expect(last).toContain('Call Sam first.');
    // Only the rigging page carries them.
    for (let p = 1; p < withNotes.pages; p++) expect(withNotes.text(p)).not.toContain('Call Sam first.');
    const without = await make(sampleDoc());
    expect(without.text(without.pages)).not.toContain('Call Sam first.');
    expect(without.pages).toBe(withNotes.pages);
  });

  it('puts the rigging plot just before the rigging summary, on a portrait page, turned a quarter turn', async () => {
    const { bytes, items, text } = await make(sampleDoc('c'));
    const pdf = await PDFDocument.load(bytes);
    const pages = pdf.getPages();
    const plot = pages.length - 2;
    expect(pages[plot]!.getSize().width).toBeCloseTo(595.28, 1);
    expect(pages[plot]!.getSize().height).toBeCloseTo(841.89, 1);
    const t = text(plot + 1);
    expect(t).toContain('Rigging plot');
    expect(t).toContain('PA1');
    expect(t).toContain('Soundvision origin: DSE');
    expect(t).toContain('This plot is drawn only from the Soundvision report.');
    expect(t).toContain('Created with RigPoint Array Sheet. Find it at https://mrfreekie.github.io/rigpoint-array-sheet/');
    expect(t).toContain(`Page ${plot + 1} of ${pages.length}`);
    expect(text(plot + 2)).toContain('Rigging summary');
    // The landscape top left corner lands at the portrait bottom left: the heading starts near the left edge and the foot of the sheet.
    const title = items.find((i) => i.page === plot + 1 && i.text === 'Rigging plot')!;
    expect(title.x).toBeLessThan(40);
    expect(title.y).toBeLessThan(30);
    // The footer, at the landscape bottom, is at the portrait right edge.
    const footer = items.find((i) => i.page === plot + 1 && i.text.startsWith('RigPoint Array Sheet 0.1.0'))!;
    expect(footer.x).toBeGreaterThan(550);
  });

  it('has no plot page when no array is on the plot', async () => {
    let doc = sampleDoc();
    doc.result.report.sources.forEach((_, i) => (doc = withOnPlot(doc, i, false)));
    const { all, pages } = await make(doc);
    expect(all).not.toContain('Rigging plot');
    expect(pages).toBe((await make(sampleDoc())).pages - 1);
  });

  it('has no plot page when Print rigging plot is off, and the page numbers still run on without a gap', async () => {
    const withPlot = await make(sampleDoc());
    const { all, pages, text } = await make(withPlotPrinted(sampleDoc(), false));
    expect(all).not.toContain('Rigging plot');
    expect(pages).toBe(withPlot.pages - 1);
    expect(text(pages)).toContain(`Page ${pages} of ${pages}`);
    expect(text(1)).toContain(`Page 1 of ${pages}`);
  });

  it('keeps the plot on a read-only file only for the session it was chosen in', async () => {
    const locked = { ...sampleDoc(), locked: true };
    const off = withPlotPrinted(locked, false);
    expect((await make(off)).all).not.toContain('Rigging plot');
    expect((await make(locked)).all).toContain('Rigging plot');
  });

  it('says Also mirrored with and the other array, with nothing else', async () => {
    const { all } = await make(sampleDoc());
    expect(all).toContain('Also mirrored with: KARA II R Main');
    expect(all).not.toContain('exact left-right');
  });

  it('gives every pocket panel its own header and footer', async () => {
    const { text } = await make(sampleDoc());
    const page1 = text(1);
    expect(page1).not.toContain('RIGPOINT ARRAY');
    expect(page1.match(/Created with RigPoint Array Sheet/g)).toHaveLength(4);
    expect(page1.match(/Main stage · Grand Hall/g)).toHaveLength(4);
    expect(page1.match(/Z-axis zero: Arena floor/g)).toHaveLength(4);
    expect(page1.match(/Page 1 of 5/g)?.length).toBeGreaterThanOrEqual(4);
    expect(page1).toContain('RigPoint Array Sheet 0.1.0 · Soundvision 2026.3.1');
    // One credit line under the footer of each of the four panels, below the footer text.
    const credits = (await make(sampleDoc())).items.filter((i) => i.page === 1 && i.text === CREDIT_TEXT);
    expect(credits).toHaveLength(4);
    expect(page1).toContain('(unsaved changes)'.replace('unsaved changes', 'not saved'));
  });

  it('marks a draft on every panel, and only a draft', async () => {
    const draft = await make(sampleDoc());
    expect(draft.items.filter((i) => i.text === 'DRAFT').length).toBeGreaterThanOrEqual(11); // 9 panel watermarks, the plot and the rigging page
    // The plot page carries the watermark as well as the status in its header.
    const plotPage = draft.pages - 1;
    expect(draft.items.filter((i) => i.page === plotPage && i.text === 'DRAFT')).toHaveLength(2); // the header and the watermark
    const issued = sampleDoc();
    issued.status = 'issued';
    issued.revision = 'B';
    const done = await make(issued);
    expect(done.items.some((i) => i.text === 'DRAFT')).toBe(false);
    expect(done.all).toContain('ISSUED REV B');
    expect(done.items.filter((i) => i.page === done.pages - 1 && i.text === 'DRAFT')).toHaveLength(0);
  });

  it('prints only the arrays that are chosen, and only their pickups', async () => {
    let doc = sampleDoc();
    // Leave out the left main (and the right main it stands for), a sub pair and two fills: four cards remain.
    for (const i of [0, 4, 6, 8, 9]) doc = withPrinted(doc, i, false);
    const { pages, text } = await make(doc);
    expect(pages).toBe(3); // the cards, the plot, the rigging page
    // The cards and the rigging summary follow what is chosen for printing. The plot has its own choice, so it still shows them.
    expect(text(1)).not.toContain('KARA II L Main');
    expect(text(1)).toContain('KARA II L Out');
    expect(text(1)).toContain('X12 B L');
    expect(text(2)).toContain('KARA II L Main');
    expect(text(3)).toContain('KARA II L Out');
    expect(text(3)).not.toContain('KARA II R Main');
    expect(text(3)).not.toContain('KARA II L Main');
  });

  it('has the QR address and the approved small print on the last page', async () => {
    const { text } = await make(sampleDoc());
    // The address is wrapped under the code, so join the pieces before looking for it.
    expect(text(5).replace(/ /g, '')).toContain('https://mrfreekie.github.io/rigpoint-array-sheet/');
    expect(text(5)).toContain('is provided as it is, without warranty');
    expect(text(5)).toContain('Soundvision and L-Acoustics are trademarks of their owners.');
  });

  it('lists the fixation positions of every printed array on the rigging page, and says so', async () => {
    const doc = sampleDoc('e');
    const { pages, text, items } = await make(doc);
    const last = text(pages);
    expect(items.filter((i) => i.page === pages && i.text === 'KARA II 1')).toHaveLength(4);
    expect(last).toContain('Array Fixation X (m) Y (m) Z (m)');
    expect(last).toContain('KARA II 1 Fr'); // the stack that collapses into KARA II 2 is listed with its own positions
    expect(last).toContain('KARA II 2 Fr -2.84 4.6 1');
    expect(last).toContain('Every pickup and fixation is listed, including those of mirrored arrays, because their positions differ.');
    // The fixation rows are on the rigging page and nowhere else as a table.
    expect(text(1)).not.toContain('Array Fixation');
  });

  it('leaves the fixations of an array that is not printed off the rigging page', async () => {
    const doc = sampleDoc('e');
    const at = doc.result.report.sources.findIndex((s) => s.name === 'KARA II 2');
    const { pages, items } = await make(withPrinted(doc, at, false));
    const cells = items.filter((i) => i.page === pages).map((i) => i.text);
    expect(cells).not.toContain('KARA II 2');
    expect(cells).not.toContain('KARA II 1'); // the mirror image it stands for goes with it
    expect(cells).toContain('XZ Sym of KARA II 2'); // other stacks stay
  });

  it('has no fixation table and keeps the old line when the report states no fixations', async () => {
    const { text } = await make(sampleDoc());
    expect(text(5)).not.toContain('Fixation');
    expect(text(5)).toContain('Every pickup is listed, including those of mirrored arrays, because their positions differ.');
  });

  it('cuts the middle of an array name that is too long for its column, keeping its end, in both rigging tables', async () => {
    const doc = sampleDoc('e');
    const long = `${'Long name '.repeat(8)}ends here`;
    doc.result.report.sources.find((s) => s.name === 'KARA II 2')!.name = long;
    const { pages, items } = await make(doc);
    const cut = items.filter((i) => i.page === pages && i.text.includes('…') && i.text.startsWith('Long name') && i.text.endsWith('ends here'));
    expect(cut.length).toBeGreaterThanOrEqual(4);
    expect(items.some((i) => i.page === pages && i.text === long)).toBe(false);
  });

  it('adds the number of items to check to every footer', async () => {
    const { all } = await make(sampleDoc(), false, 3);
    expect(all).toContain('3 to check against the PDF');
  });

  it('copes with characters Helvetica does not have', async () => {
    const doc = sampleDoc();
    doc.job.show = 'Show Ω 日本';
    const { all, pages } = await make(doc);
    expect(pages).toBe(5);
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
    expect(pages).toBe(5); // one long page, two grid pages of four, the plot, then the rigging page
    expect(text(1).match(/KARA II L Main/g)).toHaveLength(1);
    expect(text(1)).not.toContain('RIGPOINT ARRAY');
    expect(text(1).match(/Created with RigPoint Array Sheet/g)).toHaveLength(1);
    expect(text(1).match(/KARA II/g)?.length).toBeGreaterThanOrEqual(24);
    expect(text(2)).toContain('KARA II R Main');
    expect(text(2).match(/Created with RigPoint Array Sheet/g)).toHaveLength(4);
  });

  it('puts two 24-row arrays side by side on one long page, each with its own header and page number', async () => {
    const { pages, text } = await make(tallDoc({ 'KARA II L Main': 24, 'KARA II R Main': 24, 'KARA II L Out': 24, 'KARA II R Out': 24 }, false));
    expect(pages).toBe(5); // two long columns on one page, then grid pages of four and three, the plot, then the rigging page
    expect(text(1)).toContain('KARA II L Main');
    expect(text(1)).toContain('KARA II L Out');
    expect(text(1).match(/Created with RigPoint Array Sheet/g)).toHaveLength(2);
    expect(text(1).match(/Page 1 of 5/g)).toHaveLength(2);
    expect(text(2).match(/Created with RigPoint Array Sheet/g)).toHaveLength(4);
  });

  it('marks a long page with a DRAFT word per column and a dashed centre line, and a grid page with the dashed cross', async () => {
    const { bytes, items, pages } = await make(tallDoc({ 'KARA II L Main': 24, 'KARA II R Main': 24, 'KARA II L Out': 24, 'KARA II R Out': 24 }, false));
    // The header of each column also says DRAFT, at the top of the page; the watermark sits lower, mid-column.
    expect(items.filter((i) => i.page === 1 && i.text === 'DRAFT' && i.y < 700)).toHaveLength(2);
    const marks = await foldMarks(bytes);
    expect(marks).toHaveLength(pages);
    expect(marks[0]).toEqual({ ticks: 0, dashed: 1 }); // the vertical centre line only, no horizontal fold
    expect(marks[1]).toEqual({ ticks: 0, dashed: 2 });
    expect(marks[2]).toEqual({ ticks: 0, dashed: 2 });
    expect(marks[pages - 1]).toEqual({ ticks: 0, dashed: 0 }); // the rigging page has no fold marks
    expect(marks[pages - 2]).toEqual({ ticks: 0, dashed: 0 }); // nor has the plot
  });

  it('puts a 48-row array in a long column too, so the page count is the same', async () => {
    const { pages, text } = await make(tallDoc({ 'KARA II L Main': 48 }));
    expect(pages).toBe(5);
    expect(text(1).match(/KARA II/g)?.length).toBeGreaterThanOrEqual(48);
  });

  it('with the mirrored arrays shown, prints all eighteen', async () => {
    const { pages, all } = await make(sampleDoc(), true);
    expect(pages).toBe(7); // 18 = 4 + 4 + 4 + 4 + 2, then the plot, then rigging
    expect(all).toContain('KARA II R Main');
  });
});

describe('renderPdf with fixations (report E)', () => {
  it('writes the fixations of each of the eight stacked fills into the PDF', async () => {
    const { all } = await make(sampleDoc('e'), true);
    expect(all.match(/Fixations/g)).toHaveLength(8);
    expect(all).toContain('X (m) Y (m) Z (m)');
    expect(all).toContain('-2.84');
    expect(all).toContain('3.9');
  });
});
