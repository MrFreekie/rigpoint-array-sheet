// The cable patch on the printed outputs: the print view's content, the PDF drawing steps, the PNG and the PDF text.

import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { PATCH_COLOURS, type PatchDigit } from '../engine/patch';
import { plotArrays } from '../engine/plot';
import { readPdfItems } from '../files/pdf-items';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withPatch, type Doc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { estimateWidth, layoutCardImage, type DrawOp } from './array-image';
import { CARD_TABLE_WIDTHS_MM, cardContent, FIXATION_NUMBER_MM, PATCH_CHIP } from './card-content';
import { printFooter } from './footer';
import { CARD_W_MM, planPages, PX_PER_MM } from './layout';
import { renderPdf } from './pdf-export';
import { layoutPocketCard, PT_PER_MM, ptToPx } from './pdf-layout';
import { plotDxf } from './plot-dxf';
import { plotContent } from './plot-input';

const ctx = { show: 'Main stage', venue: 'Grand Hall', status: 'issued' as const, revision: 'B', zAxisZero: 'Arena floor' };
const FIXTURES = ['a', 'b', 'c', 'd', 'e'] as const;
const docOf = (name: (typeof FIXTURES)[number]) => newDoc(parseFixture(name), `${name}.pdf`);
const mm = (n: number) => n * PT_PER_MM;

/** Give every row of an array a feeder and a way, cycling through the ten digits. */
function patched(doc: Doc, index: number): Doc {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
  let out = doc;
  (doc.result.report.sources[index]?.cabinets ?? []).forEach((_, r) => {
    out = withPatch(out, index, r, 'feeder', digits[r % 10] as PatchDigit);
    out = withPatch(out, index, r, 'way', digits[(r + 3) % 10] as PatchDigit);
  });
  return out;
}
const everyArray = (doc: Doc): Doc => doc.result.report.sources.reduce((d, _, i) => patched(d, i), doc);
const entryOf = (doc: Doc, name: string) => sheetModel(doc, true).entries.find((e) => e.column.name === name)!;
const text = (ops: DrawOp[]) => ops.filter((o): o is Extract<DrawOp, { op: 'text' }> => o.op === 'text');

describe('the columns of the card table', () => {
  const columns = (doc: Doc, name: string) => cardContent(entryOf(doc, name), ctx).columns;

  it('put the feeder and the way last, after Angle, and leave the per enclosure site off the card', () => {
    expect(columns(docOf('a'), 'KARA II L Main')).toEqual(['#', 'Type', 'Panflex', 'Angle', 'Feeder', 'Way']);
    expect(columns(docOf('a'), 'SB28 L Front')).toEqual(['#', 'Type', 'Feeder', 'Way']);
    expect(columns(docOf('d'), 'SB28 L')).toEqual(['Col #', 'Type', 'Feeder', 'Way']);
    for (const name of ['KARA II L Main', 'SB28 L Front']) expect(columns(docOf('a'), name)).not.toContain('Site');
  });

  it('are always there, blank when nothing was chosen, and hold the digit when one was', () => {
    const blank = cardContent(entryOf(docOf('a'), 'KARA II L Main'), ctx);
    const at = blank.columns.indexOf('Feeder');
    expect(blank.rows.every((r) => r[at] === '' && r[at + 1] === '')).toBe(true);
    const set = withPatch(withPatch(docOf('a'), 0, 1, 'feeder', '4'), 0, 1, 'way', '0');
    const rows = cardContent(entryOf(set, 'KARA II L Main'), ctx).rows;
    expect(rows[1]?.slice(at, at + 2)).toEqual(['4', '0']);
    expect(rows[0]?.slice(at, at + 2)).toEqual(['', '']);
  });

  it('leave room: the fixed columns of the widest table leave Type at least 35 mm of the 93 mm card', () => {
    const widest = ['Col #', 'Panflex', 'Angle', 'Feeder', 'Way'].reduce((n, c) => n + (CARD_TABLE_WIDTHS_MM[c] ?? 0), 0);
    expect(CARD_W_MM - widest).toBeGreaterThanOrEqual(35);
  });
});

describe('the pocket card in the PDF', () => {
  const sample = everyArray(docOf('a'));
  const card = (doc: Doc, name: string) => layoutPocketCard(cardContent(entryOf(doc, name), ctx), estimateWidth);

  it('keeps every column header and the longest enclosure type of every sample in its column, in Helvetica', async () => {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (const [title, widthMm] of Object.entries(CARD_TABLE_WIDTHS_MM)) {
      expect(bold.widthOfTextAtSize(title, 7) + 4, title).toBeLessThanOrEqual(mm(widthMm));
    }
    const widths = Object.values(CARD_TABLE_WIDTHS_MM);
    expect(widths.length).toBeGreaterThan(0);
    const typeRoom = mm(CARD_W_MM - ['Col #', 'Panflex', 'Angle', 'Feeder', 'Way'].reduce((n, c) => n + (CARD_TABLE_WIDTHS_MM[c] ?? 0), 0)) - 4;
    const types = new Set(FIXTURES.flatMap((f) => parseFixture(f).report.sources.flatMap((s) => s.cabinets.map((c) => c.type))));
    types.add('A15 FOCUS');
    for (const t of types) expect(regular.widthOfTextAtSize(t, 7), t).toBeLessThanOrEqual(typeRoom);
  });

  it('centres every value of the enclosure table except Type, which is left', () => {
    const c = cardContent(entryOf(sample, 'KARA II L Main'), ctx);
    const laid = layoutPocketCard(c, estimateWidth);
    const texts = text(laid.ops);
    const typeCells = texts.filter((o) => o.text === 'KARA II' && o.size === 7);
    expect(typeCells).toHaveLength(15);
    for (const o of typeCells) expect(o.align).toBe('left');
    for (const title of ['#', 'Panflex', 'Angle', 'Feeder', 'Way']) {
      const header = texts.find((o) => o.text === title && o.bold);
      expect(header?.align, title).toBe('center');
    }
    for (const o of texts.filter((t) => ['70', '90 On', '3.8', '-41.2'].includes(t.text))) expect(o.align, o.text).toBe('center');
    // The fixation names stay left, and their X, Y and Z are centred.
    const stacked = layoutPocketCard(cardContent(entryOf(docOf('e'), 'KARA II 2'), ctx), estimateWidth);
    const fixTexts = text(stacked.ops);
    expect(fixTexts.find((o) => o.text === 'Fr')?.align).toBe('left');
    expect(fixTexts.find((o) => o.text === '-2.84')?.align).toBe('center');
    expect(fixTexts.find((o) => o.text === 'X (m)')?.align).toBe('center');
    expect(FIXATION_NUMBER_MM).toBe(14);
  });

  it('draws a colour chip for each digit, with the text colour of that digit, and an outline on the white one only', () => {
    const laid = card(sample, 'KARA II L Main');
    const chips = laid.ops.filter((o): o is Extract<DrawOp, { op: 'rect' }> => o.op === 'rect' && o.fill !== null && o.fill !== '#e4e4e4' && o.w < mm(5));
    expect(chips).toHaveLength(30);
    for (const d of Object.keys(PATCH_COLOURS) as PatchDigit[]) {
      const c = PATCH_COLOURS[d];
      const mine = chips.filter((o) => o.fill === c.fill);
      expect(mine.length, c.name).toBeGreaterThan(0);
      for (const o of mine) {
        expect(o.w).toBeCloseTo(mm(PATCH_CHIP.widthMm), 6);
        expect(o.h).toBeCloseTo(PATCH_CHIP.heightPt, 6);
        expect(o.stroke).toBe(c.outline);
        if (c.outline) expect(o.lineWidth).toBeCloseTo(mm(PATCH_CHIP.outlineMm), 6);
      }
      const digits = text(laid.ops).filter((o) => o.color === c.text && o.text === d && o.bold && o.align === 'center');
      expect(digits.length, c.name).toBeGreaterThan(0);
    }
  });

  it('draws an empty pencil box in every blank feeder and way cell: white, with a thin black outline, and no digit', () => {
    const laid = card(docOf('a'), 'KARA II L Main');
    const boxes = laid.ops.filter((o): o is Extract<DrawOp, { op: 'rect' }> => o.op === 'rect' && o.fill !== null && o.fill !== '#e4e4e4' && o.w < mm(5));
    expect(boxes).toHaveLength(30);
    for (const o of boxes) {
      expect(o.fill).toBe('#ffffff');
      expect(o.stroke).toBe('#000000');
      expect(o.lineWidth).toBeCloseTo(mm(PATCH_CHIP.outlineMm), 6);
      expect(o.w).toBeCloseTo(mm(PATCH_CHIP.widthMm), 6);
      expect(o.h).toBeCloseTo(PATCH_CHIP.heightPt, 6);
    }
  });

  it('is exactly as tall with a patch as without, for 12, 16, 17, 18 and 24 rows, so the page plan cannot change', () => {
    for (const rows of [12, 16, 17, 18, 24]) {
      const make = (patch: boolean) => {
        const result = parseFixture('a');
        for (const s of result.report.sources) {
          if (s.name === 'KARA II L Main' || s.name === 'KARA II R Main') s.cabinets = Array.from({ length: rows }, (_, i) => s.cabinets[i % s.cabinets.length]!);
        }
        const doc = newDoc(result, 'a.pdf');
        return patch ? everyArray(doc) : doc;
      };
      const heights = (doc: Doc) => sheetModel(doc, false).entries.map((e) => layoutPocketCard(cardContent(e, ctx), estimateWidth).height);
      expect(heights(make(true)), `${rows} rows`).toEqual(heights(make(false)));
    }
  });

  it('plans the same pages for the samples A to E with and without a patch', () => {
    for (const f of FIXTURES) {
      const plan = (doc: Doc) =>
        planPages(
          sheetModel(doc, false)
            .entries.filter((e) => e.print)
            .map((e) => ({ item: e.index, heightPx: ptToPx(layoutPocketCard(cardContent(e, ctx), estimateWidth).height) })),
        ).map((p) => ({ kind: p.kind, cards: p.cards.map((c) => [c.item, c.scale]) }));
      expect(plan(everyArray(docOf(f))), f).toEqual(plan(docOf(f)));
    }
    expect(PX_PER_MM).toBeGreaterThan(0);
  });
});

describe('the card as an image', () => {
  const options = { footer: 'footer', draft: false };

  it('centres every value except Type, draws the chips and keeps all of it inside the image', () => {
    const doc = patched(docOf('a'), 0);
    const laid = layoutCardImage(cardContent(entryOf(doc, 'KARA II L Main'), ctx), options, estimateWidth);
    const texts = text(laid.ops);
    for (const o of texts.filter((t) => t.text === 'KARA II' && t.size === 14)) expect(o.align).toBe('left');
    for (const title of ['#', 'Panflex', 'Angle', 'Feeder', 'Way']) expect(texts.find((o) => o.text === title && o.bold && o.size === 14)?.align, title).toBe('center');
    const chips = laid.ops.filter((o): o is Extract<DrawOp, { op: 'rect' }> => o.op === 'rect' && o.fill !== null && o.fill !== '#e4e4e4' && o.w < 40);
    expect(chips).toHaveLength(30);
    expect(chips.find((o) => o.fill === '#ffffff')?.stroke).toBe('#000000');
    expect(chips.find((o) => o.fill === '#000000')?.stroke).toBeNull();
    for (const o of chips) {
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.x + o.w).toBeLessThanOrEqual(laid.width);
    }
    const white = texts.find((o) => o.color === '#000000' && o.text === '9' && o.bold);
    expect(white).toBeDefined();
  });

  it('is as tall with a patch as without', () => {
    const height = (doc: Doc) => layoutCardImage(cardContent(entryOf(doc, 'KARA II L Main'), ctx), options, estimateWidth).height;
    expect(height(everyArray(docOf('a')))).toBe(height(docOf('a')));
  });
});

describe('the PDF text', () => {
  const FOOTER = printFooter({ appVersion: '0.1.0', soundvisionVersion: '2026.3.1', fileName: null, defaultName: 'x.arraysheet.json', dirty: true, printedAt: new Date(2026, 9, 22, 9, 5), verb: 'Exported' });

  it('holds the Feeder and Way headings and the digits in row order', async () => {
    const doc = withPatch(withPatch(withPatch(docOf('a'), 0, 0, 'feeder', '1'), 0, 0, 'way', '2'), 0, 1, 'way', '0');
    const bytes = await renderPdf({ doc, model: sheetModel(doc, false), footer: FOOTER, checks: 0 });
    const items = await readPdfItems(bytes.slice());
    const page1 = items.filter((i) => i.page === 1).map((i) => i.text);
    expect(page1).toContain('Feeder');
    expect(page1).toContain('Way');
    expect(page1.filter((t) => t === 'Feeder')).toHaveLength(4);
    // The first card's first two rows: the Panflex value and the Angle, then the digits last, in row order.
    const flat = page1.join('|');
    expect(flat).toMatch(/KARA II\|70\|5\|1\|2\|/);
    expect(flat).toMatch(/\|2\|KARA II\|70\|2\|0\|3\|KARA II/);
  });
});

describe('the rigging plot and the DXF', () => {
  it('do not change with a patch', () => {
    for (const f of FIXTURES) {
      const plain = docOf(f);
      const set = everyArray(docOf(f));
      expect(JSON.stringify(plotContent(set, sheetModel(set, false)))).toBe(JSON.stringify(plotContent(plain, sheetModel(plain, false))));
      const dxf = (doc: Doc) => {
        const content = plotContent(doc, sheetModel(doc, false));
        return content ? plotDxf({ ...content, footer: () => '' }, estimateWidth) : null;
      };
      expect(dxf(set)).toBe(dxf(plain));
      expect(plotArrays(sheetModel(set, false).sources, new Set(sheetModel(set, false).live)).drawn.length).toBe(plotArrays(sheetModel(plain, false).sources, new Set(sheetModel(plain, false).live)).drawn.length);
    }
  });
});
