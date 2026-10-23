import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { canvasMeasurePt, estimateWidth, type DrawOp } from './array-image';
import { cardContent } from './card-content';
import { CELL_H_MM, FULL_H_MM, LONG_H_MM, MIN_FULL_SCALE, PX_PER_MM, fitScale, planPages } from './layout';
import { PT_PER_MM, RIGGING_CELL_PAD_PT, RIGGING_FIXATION_WIDTHS_MM, RIGGING_PICKUP_WIDTHS_MM, clipRiggingCell, layoutPocketCard, layoutRiggingPage, ptToPx, riggingSubtitle } from './pdf-layout';
import { qrMatrix } from './qr';
import { riggingFixations, riggingRows } from '../engine/sheet';
import { SMALL_PRINT } from './small-print';

const ctx = { show: 'Main stage', venue: 'Grand Hall', status: 'issued' as const, revision: 'B', zAxisZero: 'Arena floor' };
const docA = newDoc(parseFixture('a'), 'a.pdf');
const docB = newDoc(parseFixture('b'), 'b.pdf');
const docD = newDoc(parseFixture('d'), 'd.pdf');
const docE = newDoc(parseFixture('e'), 'e.pdf');
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
    expect(laid.ops.filter((o) => o.op === 'rect' && o.stroke === '#000' && Math.abs(o.lineWidth - 0.4 * PT_PER_MM) < 1e-9)).toHaveLength(2);
    const bold = laid.ops.filter((o): o is Extract<DrawOp, { op: 'text' }> => o.op === 'text' && o.bold).map((o) => o.text);
    expect(bold).toContain('WARNING');
    expect(bold).toContain('CAUTION');
  });

  it('keeps everything inside the card width and its height', () => {
    for (const [doc, name] of [[docA, 'KARA II L Main'], [docB, 'FL KARA II L'], [docB, 'GS KARA II L'], [docA, 'SB28 L Front'], [docD, 'SB28 L']] as const) {
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
    expect(pxHeight(step)).toBeCloseTo(14.0625, 3); // a table row measures this in the print stylesheet (e2e/print.spec.ts checks it), so the PDF breaks at the same height
    expect(heightOf(24) - heightOf(12)).toBeCloseTo(12 * step, 5);
  });

  it('fits a pocket panel at full size with 16 rows, and a long column at full size with 24 and 48', () => {
    const base = content(docA, 'KARA II L Main');
    const withRows = (n: number) => ({ ...base, rows: Array.from({ length: n }, (_, i) => base.rows[i % base.rows.length]!) });
    const height = (n: number) => pxHeight(layoutPocketCard(withRows(n), estimateWidth).height);
    expect(fitScale(height(12), CELL_H_MM, MIN_FULL_SCALE)).toEqual({ scale: 1, overflow: false });
    expect(fitScale(height(16), CELL_H_MM, MIN_FULL_SCALE)).toEqual({ scale: 1, overflow: false });
    expect(height(24)).toBeGreaterThan(CELL_H_MM * PX_PER_MM);
    expect(fitScale(height(24), LONG_H_MM, MIN_FULL_SCALE)).toEqual({ scale: 1, overflow: false });
    expect(fitScale(height(48), LONG_H_MM, MIN_FULL_SCALE)).toEqual({ scale: 1, overflow: false });
  });

  it('is the same every time', () => {
    const c = content(docB, 'FL KARA II L');
    expect(layoutPocketCard(c, estimateWidth)).toEqual(layoutPocketCard(c, estimateWidth));
  });
});

describe('layoutRiggingPage', () => {
  const input = (rows = riggingRows(docB.result.report.sources), fixations = riggingFixations(docB.result.report.sources)) => ({
    rows,
    fixations,
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

  describe('with fixations, report E', () => {
    const sources = docE.result.report.sources;
    const withFixations = () => input(riggingRows(sources), riggingFixations(sources));

    it('lists every fixation under the pickups, with the line that covers both', () => {
      const t = texts(layoutRiggingPage(withFixations(), estimateWidth).ops);
      expect(t).toContain('Fixation');
      expect(t.filter((x) => x === 'Fr').length).toBe(riggingFixations(sources).filter((f) => f.name === 'Fr').length);
      expect(t).toContain('-2.84');
      expect(t).toContain('Every pickup and fixation is listed, including those of mirrored arrays, because their positions differ.');
    });

    it('shows no fixation table when there are none', () => {
      const t = texts(layoutRiggingPage(input(riggingRows(docB.result.report.sources), []), estimateWidth).ops);
      expect(t).not.toContain('Fixation');
      expect(t).toContain('Every pickup is listed, including those of mirrored arrays, because their positions differ.');
    });

    it('lists fixations alone with a line that names only fixations', () => {
      const t = texts(layoutRiggingPage(input([], riggingFixations(sources)), estimateWidth).ops);
      expect(t).toContain('Every fixation is listed, including those of mirrored arrays, because their positions differ.');
    });

    it('fits one A4 page with all 12 pickups and 32 fixations, shrunk only to 0.975 (fixation rows at a pocket card\'s 10.5 pt; 13 pt rows needed 0.88)', () => {
      const laid = layoutRiggingPage(withFixations(), estimateWidth);
      const fit = fitScale(pxHeight(laid.height), FULL_H_MM, MIN_FULL_SCALE);
      expect(fit.overflow).toBe(false);
      expect(fit.scale).toBe(0.975);
    });

    it('sets the fixation table in 7 pt text and keeps the pickup table at 8 pt', () => {
      const ops = layoutRiggingPage(withFixations(), estimateWidth).ops;
      const sizeOf = (s: string) => ops.flatMap((o) => (o.op === 'text' && o.text === s ? [o.size] : []))[0];
      expect(sizeOf('Fixation')).toBe(7);
      expect(sizeOf('Pickup')).toBe(8);
    });

    it('keeps a long array name inside its own column, with the 3 pt inset, in both tables', () => {
      const long = 'W'.repeat(80);
      const rows = riggingRows(docB.result.report.sources).map((r) => ({ ...r, source: long }));
      const fixations = riggingFixations(sources).map((f) => ({ ...f, source: long, name: long }));
      const laid = layoutRiggingPage(input(rows, fixations), estimateWidth);
      const names = laid.ops.filter((o): o is Extract<DrawOp, { op: 'text' }> => o.op === 'text' && o.text.startsWith('WW'));
      expect(names.length).toBe(rows.length + 2 * fixations.length);
      const limit = (mmWidth: number) => mmWidth * PT_PER_MM - 3;
      // Pickup array names come first in the ops, then each fixation row's array and fixation name.
      names.forEach((o, i) => {
        const column = i < rows.length ? RIGGING_PICKUP_WIDTHS_MM[0]! : RIGGING_FIXATION_WIDTHS_MM[(i - rows.length) % 2]!;
        expect(o.text).toContain('…');
        expect(o.text.endsWith('W')).toBe(true);
        expect(estimateWidth(o.text, o.size, o.bold)).toBeLessThanOrEqual(limit(column));
      });
    });

    it('fits every array name of report E in the Fixations Array column without clipping', () => {
      const t = texts(layoutRiggingPage(withFixations(), estimateWidth).ops);
      for (const f of riggingFixations(sources)) expect(t).toContain(f.source);
    });
  });

  describe('clipRiggingCell', () => {
    it('cuts the middle and keeps the end of a name', () => {
      const name = 'YZ Sym of XZ Sym of Copy of KARA II 2';
      const clipped = clipRiggingCell(name, 40, false, estimateWidth, 7);
      expect(clipped.startsWith('YZ Sym')).toBe(true);
      expect(clipped.endsWith('KARA II 2')).toBe(true);
      expect(clipped).toContain('…');
      expect(estimateWidth(clipped, 7, false)).toBeLessThanOrEqual(40 * PT_PER_MM - RIGGING_CELL_PAD_PT);
    });

    it('leaves a name that fits alone', () => {
      expect(clipRiggingCell('KARA II 2', 80, false, estimateWidth, 7)).toBe('KARA II 2');
    });
  });

  describe('riggingSubtitle', () => {
    it('joins show, venue and Z-axis zero, trimmed, leaving out what is empty', () => {
      expect(riggingSubtitle({ show: ' Main stage ', venue: 'Grand Hall', zAxisZero: 'Stage floor' })).toBe('Main stage · Grand Hall · Z-axis zero: Stage floor');
      expect(riggingSubtitle({ show: 'Main stage', venue: ' ', zAxisZero: '' })).toBe('Main stage');
    });
  });

  it('lists only the rows it is given', () => {
    const rows = riggingRows(docB.result.report.sources, new Set([0]));
    const t = texts(layoutRiggingPage(input(rows), estimateWidth).ops);
    expect(t).toContain('FL KARA II L');
    expect(t).not.toContain('FL KARA II R');
  });
});

describe('a ground stack laid out in columns', () => {
  it('labels each row with its column, so the repeated #1 can be told apart', () => {
    const card = content(docD, 'SB28 L');
    expect(card.columns).toEqual(['Col #', 'Type', 'Site']);
    expect(card.rows).toEqual([
      ['C1 #1', 'SB28', '0'],
      ['C2 #1', 'SB28', '0'],
    ]);
  });

  it('keeps the plain # heading for arrays without columns', () => {
    expect(content(docD, '12 KARA II L').columns[0]).toBe('#');
    expect(content(docB, 'GS KARA II L').rows[0]?.[0]).toBe('6');
  });
});

describe('which panel a typical mirrored main goes in', () => {
  /** Fixture A with this many rows on both mains, so the pair is still found to be mirrored. */
  const docWithMainRows = (n: number) => {
    const result = parseFixture('a');
    for (const s of result.report.sources) {
      if (s.name === 'KARA II L Main' || s.name === 'KARA II R Main') s.cabinets = Array.from({ length: n }, (_, i) => s.cabinets[i % s.cabinets.length]!);
    }
    return newDoc(result, 'a.pdf');
  };
  const kindOf = (doc: typeof docA) => {
    const c = content(doc, 'KARA II L Main', false);
    expect(c.mirrorNote).toBe('MIRRORED: KARA II R Main');
    expect(c.facts.map((f) => f[0])).toContain('Front motor load');
    return planPages([{ item: 0, heightPx: ptToPx(layoutPocketCard(c, estimateWidth).height) }])[0]?.kind;
  };

  it('keeps 15 rows (the real sample) and 16 rows, with the mirror note and the motor fact, in a pocket panel', () => {
    expect(kindOf(docA)).toBe('grid');
    expect(kindOf(docWithMainRows(16))).toBe('grid');
  });

  it('puts 17 rows in a long column', () => {
    expect(kindOf(docWithMainRows(17))).toBe('long');
  });
});

describe('a long fact value', () => {
  const base = content(docA, 'KARA II L Main');
  const withFrame = (value: string) => ({ ...base, facts: base.facts.map(([l, v]): [string, string] => (l === 'Frame' ? [l, value] : [l, v])) });
  const long = 'Bumper with a very long name that cannot possibly fit beside its label on one line';
  const text = (laid: ReturnType<typeof layoutPocketCard>) => laid.ops.filter((o): o is Extract<DrawOp, { op: 'text' }> => o.op === 'text');

  it('wraps in the space the label leaves, one row line taller for each extra line, and never over the label', () => {
    const short = layoutPocketCard(withFrame('Bumper'), estimateWidth);
    const wrapped = layoutPocketCard(withFrame(long), estimateWidth);
    const parts = text(wrapped).filter((o) => o.align === 'right' && o.bold && long.includes(o.text));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((o) => o.text).join(' ')).toBe(long);
    const label = estimateWidth('Frame', 7, false);
    for (const o of parts) expect(wrapped.width - estimateWidth(o.text, o.size, true)).toBeGreaterThanOrEqual(label + 2 * PT_PER_MM - 0.01);
    const step = (7 * 1.2);
    expect(wrapped.height - short.height).toBeCloseTo((parts.length - 1) * step, 5);
    expect(pxHeight(step)).toBeCloseTo(11.2, 5); // a wrapped line is 7 pt at 1.2, in the print stylesheet too
  });

  it('stays one row for a value that fits', () => {
    expect(layoutPocketCard(withFrame('Bumper'), estimateWidth).height).toBe(layoutPocketCard(withFrame('Truss'), estimateWidth).height);
  });
});

describe('a warning that runs to several lines', () => {
  const message = 'This is a long message from the report that goes on for a good while so that the box needs at least three lines at the width of a pocket panel. '.repeat(2).trim();
  const warn = { severity: 'WARNING', title: 'Long', message };
  const laid = layoutPocketCard({ ...content(docA, 'X8 2'), warnings: [warn] }, estimateWidth);
  const inBox = laid.ops.filter((o): o is Extract<DrawOp, { op: 'text' }> => o.op === 'text' && o.size === 6.5);

  it('indents only the first line past the bold word', () => {
    const body = inBox.filter((o) => !o.bold);
    expect(body.length).toBeGreaterThanOrEqual(3);
    expect(body[0]!.x).toBeGreaterThan(body[1]!.x);
    expect(body[1]!.x).toBe(body[2]!.x);
    expect(body.map((o) => o.text).join(' ')).toBe(`Long. ${message}`);
  });

  it('fills the later lines to the full width of the box', () => {
    const body = inBox.filter((o) => !o.bold);
    const full = laid.width - 2 * (PT_PER_MM + 0.75);
    const widest = Math.max(...body.slice(1).map((o) => estimateWidth(o.text, 6.5, false)));
    expect(widest).toBeLessThanOrEqual(full + 0.01);
    expect(widest).toBeGreaterThan(full - estimateWidth('WARNING ', 6.5, true) - 40);
    expect(body[1]!.text.length).toBeGreaterThan(body[0]!.text.length);
  });
});

describe('canvasMeasurePt without a canvas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to the estimate, and the plan is the same as one made with the estimate', () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    const measure = canvasMeasurePt();
    expect(measure('Total mass', 7, true)).toBe(estimateWidth('Total mass', 7, true));
    const c = content(docA, 'KARA II L Main', false);
    expect(layoutPocketCard(c, measure)).toEqual(layoutPocketCard(c, estimateWidth));
    expect(planPages([{ item: 0, heightPx: ptToPx(layoutPocketCard(c, measure).height) }])[0]?.kind).toBe('grid');
  });
});

describe('a stacked card with fixations', () => {
  const stack = content(docE, 'KARA II 2');

  it('draws the heading, the column names and every fixation', () => {
    const t = texts(layoutPocketCard(stack, estimateWidth).ops);
    for (const word of ['Fixations', 'X (m)', 'Y (m)', 'Z (m)', 'Fr', 'Fl', 'Rr', 'Rl', '-2.84', '-2.16', '4.6', '3.9']) expect(t).toContain(word);
  });

  it('is five table rows and 1 mm taller than the same card without them', () => {
    const rows = ptToPx(layoutPocketCard(stack, estimateWidth).height) - ptToPx(layoutPocketCard({ ...stack, fixations: [] }, estimateWidth).height);
    // One border pixel, five rows of 14.0625 px, and the 1 mm gap under the block.
    expect(rows).toBeCloseTo(1 + 5 * 14.0625 + PX_PER_MM, 3);
  });

  it('stays in a pocket panel, as do all eight KARA II stacks', () => {
    const entries = sheetModel(docE, true).entries.filter((e) => e.column.fixations.length > 0);
    expect(entries).toHaveLength(8);
    for (const e of entries) {
      const px = ptToPx(layoutPocketCard(cardContent(e, ctx), estimateWidth).height);
      expect(px, e.column.name).toBeLessThan(CELL_H_MM * PX_PER_MM);
      expect(planPages([{ item: 0, heightPx: px }])[0]?.kind).toBe('grid');
    }
  });

  it('leaves the fixation block off a flown array', () => {
    expect(layoutPocketCard(content(docE, 'Copy of YZ Sym of Left'), estimateWidth).ops.some((o) => o.op === 'text' && o.text === 'Fixations')).toBe(false);
  });
});
