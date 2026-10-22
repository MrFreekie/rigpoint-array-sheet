// Builds the PDF and reads it back with the app's own PDF reader, so the tests see what a person would.

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

  it('keeps a 24-row array in its pocket panel, so the page count does not change', async () => {
    const doc = sampleDoc();
    const first = doc.result.report.sources[0]!;
    const row = first.cabinets[0]!;
    first.cabinets = Array.from({ length: 24 }, (_, i) => ({ ...row, number: i + 1 }));
    const { pages, text } = await make(doc);
    expect(pages).toBe(4);
    expect(text(1).match(/KARA II/g)?.length).toBeGreaterThanOrEqual(24);
  });

  it('gives an array too tall for a panel a page of its own', async () => {
    const doc = sampleDoc();
    const first = doc.result.report.sources[0]!;
    const row = first.cabinets[0]!;
    first.cabinets = Array.from({ length: 48 }, (_, i) => ({ ...row, number: i + 1 }));
    // The tall array leaves the first grid page, which carries the rest, and rigging comes last.
    expect((await make(doc)).pages).toBe(5);
  });

  it('with the mirrored arrays shown, prints all eighteen', async () => {
    const { pages, all } = await make(sampleDoc(), true);
    expect(pages).toBe(6); // 18 = 4 + 4 + 4 + 4 + 2, then rigging
    expect(all).toContain('KARA II R Main');
  });
});
