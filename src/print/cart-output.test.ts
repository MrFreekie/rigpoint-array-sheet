// Carts on the printed outputs: which rows are shaded, in the card content, the PDF drawing steps and the PNG, and that shading
// changes nothing about a card's height. Also the colour of the band.

import { describe, expect, it } from 'vitest';
import { CART_SHADE } from '../engine/carts';
import { printerLuma } from '../engine/patch';
import { parseFixture } from '../testing/fixtures';
import { cartsOf, newDoc, withCartBreak, withCartSize, withCartSizes, type Doc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { estimateWidth, layoutCardImage, type DrawOp } from './array-image';
import { cardContent, CARD_TABLE_WIDTHS_MM } from './card-content';
import { layoutPocketCard, PT_PER_MM } from './pdf-layout';

const ctx = { show: 'Main stage', venue: 'Grand Hall', status: 'issued' as const, revision: 'B', zAxisZero: 'Arena floor' };
const doc = (name: 'a' | 'c'): Doc => newDoc(parseFixture(name), `${name}.pdf`);
const entryOf = (d: Doc, name: string) => sheetModel(d, true).entries.find((e) => e.column.name === name)!;
const mm = (n: number) => n * PT_PER_MM;
type Rect = Extract<DrawOp, { op: 'rect' }>;
const bands = (ops: DrawOp[]): Rect[] => ops.filter((o): o is Rect => o.op === 'rect' && o.fill === CART_SHADE);

describe('the shading of a card', () => {
  it('is one flag for each row: every other cart, counted from the top, the first one white', () => {
    const content = cardContent(entryOf(doc('a'), 'KARA II L Main'), ctx);
    expect(content.cartShade).toHaveLength(15);
    expect(content.cartShade).toEqual([...Array(3).fill(false), ...Array(3).fill(true), ...Array(3).fill(false), ...Array(3).fill(true), ...Array(3).fill(false)]);
  });

  it('is all white for an array that is one block, so the card looks as it did before carts', () => {
    const d = withCartSizes(doc('a'), []);
    expect(cardContent(entryOf(d, 'KARA II L Main'), ctx).cartShade.every((s) => !s)).toBe(true);
    expect(cardContent(entryOf(doc('a'), 'SB28 L Front'), ctx).cartShade).toEqual([false]);
  });

  it('follows a hand cut array', () => {
    const d = withCartSize(doc('a'), 0, 5);
    const shade = cardContent(entryOf(d, 'KARA II L Main'), ctx).cartShade;
    expect(shade.filter(Boolean)).toHaveLength(5);
    expect(shade.slice(5, 10).every(Boolean)).toBe(true);
  });

  it('breaks at a change of type, then cuts each type by its own size', () => {
    const d = doc('c');
    const name = d.result.report.sources.find((s) => new Set(s.cabinets.map((c) => c.type)).size > 1)!.name;
    const i = d.result.report.sources.findIndex((s) => s.name === name);
    expect(cartsOf(d, i).forced.length).toBeGreaterThan(0);
  });
});

describe('the shaded rows in the PDF', () => {
  const laid = (d: Doc, name: string) => layoutPocketCard(cardContent(entryOf(d, name), ctx), estimateWidth);

  it('are one rectangle for each shaded row, filled #ebebeb, from the left edge to the first patch column', () => {
    const l = laid(doc('a'), 'KARA II L Main');
    const rects = bands(l.ops);
    expect(rects).toHaveLength(6);
    const content = cardContent(entryOf(doc('a'), 'KARA II L Main'), ctx);
    const feeder = content.columns.indexOf('Feeder');
    const widths = content.columns.map((c) => mm(CARD_TABLE_WIDTHS_MM[c] ?? 0));
    const type = content.columns.indexOf('Type');
    widths[type] = l.width - widths.reduce((n, w) => n + w, 0);
    const edge = widths.slice(0, feeder).reduce((n, w) => n + w, 0);
    for (const r of rects) {
      expect(r.x).toBe(0);
      expect(r.w).toBeCloseTo(edge, 6);
      expect(r.stroke).toBeNull();
    }
    expect(feeder).toBeGreaterThan(0);
  });

  it('stop short of the Feeder and Way cells, so the chips and the pencil boxes stay on white', () => {
    const l = laid(doc('a'), 'KARA II L Main');
    const boxes = l.ops.filter((o): o is Rect => o.op === 'rect' && o.fill === '#ffffff' && o.w < mm(5));
    expect(boxes).toHaveLength(30);
    for (const band of bands(l.ops)) for (const box of boxes) expect(box.x).toBeGreaterThanOrEqual(band.x + band.w);
  });

  it('are drawn before the text of the row, so the shading never covers a value', () => {
    const l = laid(doc('a'), 'KARA II L Main');
    const firstText = l.ops.findIndex((o) => o.op === 'text' && o.text === 'KARA II');
    for (const band of bands(l.ops)) expect(l.ops.indexOf(band)).toBeGreaterThan(-1);
    const shadedRowTop = bands(l.ops)[0]!.y;
    const textAtRow = l.ops.findIndex((o) => o.op === 'text' && o.text === 'KARA II' && o.y >= shadedRowTop && o.y < shadedRowTop + 10);
    expect(l.ops.indexOf(bands(l.ops)[0]!)).toBeLessThan(textAtRow);
    expect(firstText).toBeGreaterThan(-1);
  });

  it('draw nothing for an array that is one block', () => {
    expect(bands(laid(withCartSizes(doc('a'), []), 'KARA II L Main').ops)).toHaveLength(0);
    expect(bands(laid(doc('a'), 'SB28 L Front').ops)).toHaveLength(0);
  });

  it('leave the height of a card exactly as it was: with the carts, with none, and hand cut', () => {
    const base = laid(withCartSizes(doc('a'), []), 'KARA II L Main').height;
    expect(laid(doc('a'), 'KARA II L Main').height).toBe(base);
    expect(laid(withCartBreak(doc('a'), 0, 4), 'KARA II L Main').height).toBe(base);
    const c = doc('c');
    expect(laid(c, 'K2 Left').height).toBe(laid(withCartSizes(c, []), 'K2 Left').height);
  });
});

describe('the shaded rows in the PNG', () => {
  it('are drawn the same way: #ebebeb from the left edge to the first patch column, one for each shaded row', () => {
    const content = cardContent(entryOf(doc('a'), 'KARA II L Main'), ctx);
    const img = layoutCardImage(content, { footer: 'footer', draft: false }, estimateWidth);
    const rects = bands(img.ops as DrawOp[]);
    expect(rects).toHaveLength(6);
    const first = rects[0]!;
    for (const r of rects) {
      expect(r.x).toBe(first.x);
      expect(r.w).toBe(first.w);
    }
    expect(layoutCardImage(cardContent(entryOf(withCartSizes(doc('a'), []), 'KARA II L Main'), ctx), { footer: 'footer', draft: false }, estimateWidth).height).toBe(img.height);
  });
});

describe('the colour of the band', () => {
  const luma = printerLuma;

  it('is a neutral grey, 20 steps of printer luma below white, and 7 above the header grey', () => {
    expect(CART_SHADE).toBe('#ebebeb');
    expect(Math.round(luma(CART_SHADE))).toBe(235);
    expect(255 - luma(CART_SHADE)).toBeGreaterThanOrEqual(20);
    expect(luma(CART_SHADE) - luma('#e4e4e4')).toBeGreaterThan(5);
  });

  it('keeps black text legible on it: at least 15 to 1', () => {
    const channel = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const n = parseInt(CART_SHADE.slice(1), 16);
    const lum = 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
    expect((lum + 0.05) / 0.05).toBeGreaterThan(15);
  });
});
