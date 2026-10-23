// A deleted array and the old name of a renamed array must not turn up in any output: the printed sheet, the PDF,
// the rigging plot, its DXF or the rigging tables. All of them read the arrays through the sheet model.

import { describe, expect, it } from 'vitest';
import { riggingFixations, riggingRows } from '../engine/sheet';
import { readPdfItems } from '../files/pdf-items';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withDeleted, withTitle, type Doc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { estimateWidth } from './array-image';
import { printFooter } from './footer';
import { renderPdf } from './pdf-export';
import { plotDxf } from './plot-dxf';
import { plotContent } from './plot-input';

const FOOTER = printFooter({
  appVersion: '0.1.0',
  soundvisionVersion: '2026.3.1',
  fileName: null,
  defaultName: 'x.arraysheet.json',
  dirty: true,
  printedAt: new Date(2026, 9, 22, 9, 5),
  verb: 'Exported',
});

const DELETED = 'SB28 L Front';
const RENAMED = 'KARA II L Main';
const TITLE = 'Zebra title';

function edited(): Doc {
  const doc = newDoc(parseFixture('a'), 'a.pdf');
  const names = doc.result.report.sources.map((s) => s.name);
  return withTitle(withDeleted(doc, names.indexOf(DELETED), true), names.indexOf(RENAMED), TITLE);
}

describe('a deleted array and a renamed array in every output', () => {
  it('start from arrays the test can tell apart', () => {
    const names = newDoc(parseFixture('a'), 'a.pdf').result.report.sources.map((s) => s.name);
    expect(names.filter((n) => n.includes(DELETED))).toEqual([DELETED]);
    expect(names.filter((n) => n.includes(RENAMED))).toEqual([RENAMED]);
  });

  it('leave the deleted name and the old name out of the PDF, and show the title', async () => {
    const doc = edited();
    const bytes = await renderPdf({ doc, model: sheetModel(doc, false), footer: FOOTER, checks: 0 });
    const items = await readPdfItems(bytes.slice());
    const all = items.map((i) => i.text).join(' ');
    expect(all).toContain(TITLE);
    expect(all).not.toContain(DELETED);
    // The report's own name is printed once, on the renamed card, in its "Soundvision name:" line, and nowhere else.
    expect(all.split(RENAMED).length).toBe(all.split(`Soundvision name: ${RENAMED}`).length);
    expect(all.split(`Soundvision name: ${RENAMED}`).length - 1).toBe(1);
  });

  it('leave them out of the rigging plot and its DXF', () => {
    const doc = edited();
    const content = plotContent(doc, sheetModel(doc, false));
    expect(content).not.toBeNull();
    const names = content!.arrays.map((a) => a.name);
    expect(names).toContain(TITLE);
    expect(names).not.toContain(DELETED);
    expect(names).not.toContain(RENAMED);
    const dxf = plotDxf({ ...content!, footer: () => '' }, estimateWidth);
    expect(dxf).not.toBeNull();
    expect(dxf).toContain(TITLE);
    expect(dxf).not.toContain(DELETED);
    expect(dxf).not.toContain(RENAMED);
  });

  it('leave them out of the rigging tables', () => {
    const doc = edited();
    const model = sheetModel(doc, false);
    const rows = riggingRows(model.sources, model.live);
    const fixations = riggingFixations(model.sources, model.live);
    const sources = [...rows.map((r) => r.source), ...fixations.map((f) => f.source)];
    expect(sources).not.toContain(DELETED);
    expect(sources).not.toContain(RENAMED);
    expect(sources).toContain(TITLE);
  });
});
