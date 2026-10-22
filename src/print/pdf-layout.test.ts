import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { estimateWidth, type DrawOp } from './array-image';
import { cardContent } from './card-content';
import { CELL_H_MM, MIN_SCALE, PX_PER_MM, fitScale } from './layout';
import { PT_PER_MM, layoutPocketCard, layoutRiggingPage } from './pdf-layout';
import { qrMatrix } from './qr';
import { riggingRows } from '../engine/sheet';
import { SMALL_PRINT } from './small-print';

const ctx = { show: 'Main stage', venue: 'Grand Hall', status: 'issued' as const, revision: 'B', zAxisZero: 'Arena floor' };
const docA = newDoc(parseFixture('a'), 'a.pdf');
const docB = newDoc(parseFixture('b'), 'b.pdf');
const content = (doc: typeof docA, name: string, mirrors = true) =>
  cardContent(sheetModel(doc, mirrors).entries.find((e) => e.column.name === name)!, ctx);
const texts = (ops: DrawOp[]) => ops.flatMap((o) => (o.op === 'text' ? [o.text] : []));
const pxHeight = (pt: number) => (pt / PT_PER_MM) * PX_PER_MM;

describe('layoutPocketCard', () => {
  it('has the title, every fact and every enclosure row', () => {
    const c = content(docA, 'KARA II L Main', false); // the card that also stands for the right-hand main
    const laid = layoutPocketCard(c, estimateWidth);
    const t = texts(laid.ops);
    expect(t).toContain('KARA II L Main');
    for (const [label, value] of c.facts) {
      expect(t).toContain(label);
      expect(t).toContain(value);
    }
    expect(t.filter((x) => x === 'KARA II')).toHaveLength(15);
    expect(t).toContain('MIRRORED: KARA II R Main');
    expect(t).toContain('90 On');
  });

  it('is as wide as an A6 panel less its padding', () => {
    expect(layoutPocketCard(content(docA, 'X8 2'), estimateWidth).width).toBeCloseTo(93 * PT_PER_MM, 5);
  });

  it('boxes each Soundvision warning, with the severity in bold', () => {
    const laid = layoutPocketCard(content(docA, 'SB28 L Front'), estimateWidth);
    expect(laid.ops.filter((o) => o.op === 'rect' && o.stroke === '#000' && o.lineWidth === 1.1)).toHaveLength(2);
    const bold = laid.ops.filter((o): o is Extract<DrawOp, { op: 'text' }> => o.op === 'text' && o.bold).map((o) => o.text);
    expect(bold).toContain('WARNING');
    expect(bold).toContain('CAUTION');
  });

  it('keeps everything inside the card width and its height', () => {
    for (const [doc, name] of [[docA, 'KARA II L Main'], [docB, 'FL KARA II L'], [docB, 'GS KARA II L'], [docA, 'SB28 L Front']] as const) {
      const laid = layoutPocketCard(content(doc, name), estimateWidth);
      for (const o of laid.ops) {
        if (o.op === 'text') {
          const w = estimateWidth(o.text, o.size, o.bold);
          const left = o.align === 'left' ? o.x : o.align === 'right' ? o.x - w : o.x - w / 2;
          expect(left, o.text).toBeGreaterThanOrEqual(-0.01);
          expect(left + w, o.text).toBeLessThanOrEqual(laid.width + 0.01);
          expect(o.y, o.text).toBeLessThanOrEqual(laid.height);
        } else if (o.op === 'rect') {
          expect(o.x + o.w).toBeLessThanOrEqual(laid.width + 0.01);
          expect(o.y + o.h).toBeLessThanOrEqual(laid.height + 0.01);
        }
      }
    }
  });

  it('gets taller with each row, by the same amount', () => {
    const base = content(docA, 'KARA II L Main');
    const heightOf = (n: number) => layoutPocketCard({ ...base, rows: Array.from({ length: n }, (_, i) => base.rows[i % base.rows.length]!) }, estimateWidth).height;
    const step = heightOf(13) - heightOf(12);
    expect(step).toBeGreaterThan(5);
    expect(heightOf(24) - heightOf(12)).toBeCloseTo(12 * step, 5);
  });

  it('fits a pocket panel at full size with 16 rows, and at a readable scale with 24', () => {
    const base = content(docA, 'KARA II L Main');
    const withRows = (n: number) => ({ ...base, rows: Array.from({ length: n }, (_, i) => base.rows[i % base.rows.length]!) });
    const fit = (n: number) => fitScale(pxHeight(layoutPocketCard(withRows(n), estimateWidth).height), CELL_H_MM, MIN_SCALE);
    expect(fit(12)).toEqual({ scale: 1, overflow: false });
    expect(fit(16)).toEqual({ scale: 1, overflow: false });
    expect(fit(24).overflow).toBe(false);
    expect(fit(24).scale).toBeGreaterThanOrEqual(0.78);
    expect(fit(24).scale).toBeLessThan(1);
  });

  it('is the same every time', () => {
    const c = content(docB, 'FL KARA II L');
    expect(layoutPocketCard(c, estimateWidth)).toEqual(layoutPocketCard(c, estimateWidth));
  });
});

describe('layoutRiggingPage', () => {
  const input = (rows = riggingRows(docB.result.report.sources)) => ({
    rows,
    subtitle: 'Main stage · Grand Hall',
    qr: qrMatrix('https://example.com/'),
    qrUrl: 'https://example.com/',
  });

  it('lists every pickup with its position and load', () => {
    const t = texts(layoutRiggingPage(input(), estimateWidth).ops);
    expect(t).toContain('Rigging summary');
    expect(t).toContain('Main stage · Grand Hall');
    expect(t).toContain('FL KARA II L');
    expect(t).toContain('182.7');
    expect(t).toContain('52.7');
    expect(t).toContain('Front');
    expect(t).toContain('Rear');
  });

  it('draws the QR code as squares, one run at a time, inside a 30 mm box at the top right', () => {
    const laid = layoutRiggingPage(input(), estimateWidth);
    const squares = laid.ops.filter((o) => o.op === 'rect' && o.fill === '#000000');
    expect(squares.length).toBeGreaterThan(50);
    const side = 30 * PT_PER_MM;
    for (const s of squares) {
      if (s.op !== 'rect') continue;
      expect(s.x).toBeGreaterThanOrEqual(laid.width - side - 0.01);
      expect(s.x + s.w).toBeLessThanOrEqual(laid.width + 0.01);
      expect(s.y + s.h).toBeLessThanOrEqual(side + 0.01);
    }
  });

  it('carries the approved small print, word for word', () => {
    const t = texts(layoutRiggingPage(input(), estimateWidth).ops).join(' ');
    for (const p of SMALL_PRINT) {
      const words = p.text.split(' ');
      // Wrapped lines are joined with spaces, so the first and last words are enough to show it is there.
      expect(t).toContain(words[0]);
      expect(t).toContain(words.slice(-3).join(' '));
    }
  });

  it('says so when no array has a pickup', () => {
    const t = texts(layoutRiggingPage(input([]), estimateWidth).ops);
    expect(t).toContain('No flown array in this report has a pickup position.');
  });

  it('lists only the rows it is given', () => {
    const rows = riggingRows(docB.result.report.sources, new Set([0]));
    const t = texts(layoutRiggingPage(input(rows), estimateWidth).ops);
    expect(t).toContain('FL KARA II L');
    expect(t).not.toContain('FL KARA II R');
  });
});
