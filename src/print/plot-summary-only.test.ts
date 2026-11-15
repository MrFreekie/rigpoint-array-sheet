// Print only the rigging plot and the rigging summary: one choice on the sheet model leaves the array cards out of the
// print view and of the PDF, and the summary still lists the arrays chosen for printing. It is not saved in the file.

import { describe, expect, it } from 'vitest';
import { readPdfItems } from '../files/pdf-items';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withPrinted } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { printFooter } from './footer';
import { renderPdf } from './pdf-export';
import { plotForPrint } from './plot-input';

const FOOTER = printFooter({
  appVersion: '0.1.0',
  soundvisionVersion: '2026.3.1',
  fileName: null,
  defaultName: 'x.arraysheet.json',
  dirty: true,
  printedAt: new Date(2026, 9, 22, 9, 5),
  verb: 'Exported',
});

async function pages(cardsOff: boolean) {
  const doc = newDoc(parseFixture('a'), 'a.pdf');
  const bytes = await renderPdf({ doc, model: sheetModel(doc, false, cardsOff), footer: FOOTER, checks: 0 });
  const items = await readPdfItems(bytes.slice());
  const count = Math.max(...items.map((i) => i.page));
  return { count, text: (n: number) => items.filter((i) => i.page === n).map((i) => i.text).join(' ') };
}

describe('print only the rigging plot and the rigging summary', () => {
  it('lists no cards in the model, and keeps the arrays chosen for printing', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    const on = sheetModel(doc, false);
    const off = sheetModel(doc, false, true);
    expect(on.cardsOff).toBe(false);
    expect(on.printedCards.length).toBe(on.entries.length);
    expect(off.cardsOff).toBe(true);
    expect(off.printedCards).toEqual([]);
    expect(off.entries.filter((e) => e.print).length).toBe(on.entries.length);
    expect([...off.printedSources]).toEqual([...on.printedSources]);
  });

  it('leaves the pocket cards out of the PDF and keeps the plot and the summary', async () => {
    const full = await pages(false);
    const short = await pages(true);
    expect(full.count).toBe(5); // four card pages, the plot, the summary
    expect(short.count).toBe(2);
    expect(short.text(1)).toContain('Rigging plot');
    expect(short.text(2)).toContain('Rigging summary');
    expect(short.text(2)).toContain('KARA II L Main');
    expect(short.text(1)).toContain('Page 1 of 2');
    expect(short.text(2)).toContain('Page 2 of 2');
  });

  it('prints the plot only when Print rigging plot is on, and the summary always', async () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    expect(plotForPrint(doc, sheetModel(doc, false, true))).not.toBeNull();
    const bytes = await renderPdf({ doc: { ...doc, plotPrintOff: true }, model: sheetModel({ ...doc, plotPrintOff: true }, false, true), footer: FOOTER, checks: 0 });
    const items = await readPdfItems(bytes.slice());
    expect(Math.max(...items.map((i) => i.page))).toBe(1);
    expect(items.map((i) => i.text).join(' ')).toContain('Rigging summary');
  });

  it('still lists only the arrays chosen for printing in the summary', async () => {
    const doc = withPrinted(newDoc(parseFixture('a'), 'a.pdf'), 0, false);
    const model = sheetModel(doc, false, true);
    expect(model.printedCards).toEqual([]);
    expect(model.printedSources.has(0)).toBe(false);
  });
});
