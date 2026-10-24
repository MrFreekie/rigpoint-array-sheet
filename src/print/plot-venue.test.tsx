import { renderToStaticMarkup } from 'react-dom/server';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { parseVenue, type Underlay } from '../engine/underlay';
import { withLayerHidden, withUnderlay } from '../files/doc';
import { parseFixture } from '../testing/fixtures';
import { newDoc, type Doc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { estimateWidth } from './array-image';
import { printFooter } from './footer';
import { renderPdf } from './pdf-export';
import { plotDxf } from './plot-dxf';
import { plotContent } from './plot-input';
import { layoutPlotPages, PLOT_H_MM, PLOT_W_MM, PRINT_PALETTE, SCREEN_PALETTE, type PlotOp } from './plot-layout';
import { PlotSvg } from './PlotSvg';

function venueText(blocks: [string, [number, number, number][]][]): string {
  const out = ['"; Exported by SU4SV v7.0"', '"; LengthUnit","m"'];
  for (const [label, pts] of blocks) out.push(`"Label","${label}"`, ...pts.map((p) => p.join(',')), '";"');
  return out.join('\n');
}

function venue(blocks: [string, [number, number, number][]][]): Underlay {
  const r = parseVenue(venueText(blocks));
  if (!r.ok) throw new Error(r.message);
  return r.underlay;
}

/** A hall around the arrays of report C, in two layers, and a lot of detail far away from the plot. */
const HALL: [string, [number, number, number][]][] = [
  ['Walls 01', [[-30, -8, 0], [30, -8, 0], [30, 60, 0], [-30, 60, 0]]],
  ['Walls 02', [[-30, -8, 8], [30, -8, 8]]],
  ['Roof 01', [[-20, 5, 14], [20, 5, 14], [20, 30, 14], [-20, 30, 14]]],
];

function far(count: number): [string, [number, number, number][]][] {
  // A lot of short lines hundreds of metres from the arrays, and some that cross the frame.
  return Array.from({ length: count }, (_, i) => [`Trees ${i + 1}`, [[400 + (i % 100) * 2, 300 + Math.floor(i / 100) * 2, 20 + (i % 7)], [401 + (i % 100) * 2, 301 + Math.floor(i / 100) * 2, 21 + (i % 7)]]] as [string, [number, number, number][]]);
}

function docWith(underlay: Underlay | null): Doc {
  const doc = newDoc(parseFixture('c'), 'c.pdf');
  doc.job.origin = 'DSE';
  return underlay ? withUnderlay(doc, underlay) : doc;
}

function layout(doc: Doc) {
  const content = plotContent(doc, sheetModel(doc, false))!;
  return { content, pages: layoutPlotPages({ ...content, footer: () => '' }, estimateWidth) };
}

const segsOf = (ops: PlotOp[]) => ops.filter((o): o is Extract<PlotOp, { op: 'segs' }> => o.op === 'segs');

describe('the venue on the plot page', () => {
  it('is drawn under the grid, the boxes and the labels, in one op for each shade of grey', () => {
    const { pages } = layout(docWith(venue(HALL)));
    const ops = pages[0]!.ops;
    const segs = ops.map((o, i) => (o.op === 'segs' ? i : -1)).filter((i) => i >= 0);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.length).toBeLessThanOrEqual(4);
    const firstGrid = ops.findIndex((o) => o.op === 'line' && o.color === 'grid');
    expect(Math.max(...segs)).toBeLessThan(firstGrid);
    const firstBox = ops.findIndex((o) => o.op === 'line' && o.color === 'ink' && o.dash);
    expect(Math.max(...segs)).toBeLessThan(firstBox);
    for (const o of segsOf(ops)) {
      expect(o.width).toBe(0.1);
      expect(o.color).toMatch(/^under[0-3]$/);
    }
  });

  it('never changes the scale, the page, or anything else on the page, however large the venue is', () => {
    const plain = layout(docWith(null)).pages[0]!;
    const huge = layout(docWith(venue([...HALL, ...far(3000)]))).pages[0]!;
    expect(huge.ratio).toBe(plain.ratio);
    expect(huge.plan).toEqual(plain.plan);
    expect(huge.overflow).toBe(plain.overflow);
    expect(huge.ops.filter((o) => o.op !== 'segs')).toEqual(plain.ops);
  });

  it('cuts every line to the plot frame, and leaves out lines that are wholly outside it', () => {
    const { pages } = layout(docWith(venue([...HALL, ...far(500)])));
    const plan = pages[0]!.plan!;
    const segs = segsOf(pages[0]!.ops);
    expect(segs.length).toBeGreaterThan(0);
    for (const o of segs) {
      for (let i = 0; i < o.pts.length; i += 2) {
        expect(o.pts[i]!).toBeGreaterThanOrEqual(plan.frame.x0 - 0.01);
        expect(o.pts[i]!).toBeLessThanOrEqual(plan.frame.x1 + 0.01);
        expect(o.pts[i + 1]!).toBeGreaterThanOrEqual(plan.frame.y0 - 0.01);
        expect(o.pts[i + 1]!).toBeLessThanOrEqual(plan.frame.y1 + 0.01);
      }
    }
    // The 500 distant short lines are not in the page at all: only the hall is.
    const lines = segs.reduce((n, o) => n + o.pts.length / 4, 0);
    expect(lines).toBeLessThan(40);
  });

  it('draws nothing for a venue that is wholly off the plot', () => {
    expect(segsOf(layout(docWith(venue(far(50)))).pages[0]!.ops)).toEqual([]);
  });

  it('puts the lowest parts in the darkest grey', () => {
    const { pages } = layout(docWith(venue(HALL)));
    const colours = segsOf(pages[0]!.ops).map((o) => o.color);
    expect(colours[0]).toBe('under0');
    for (const palette of [SCREEN_PALETTE, PRINT_PALETTE]) {
      const lum = (hex: string) => parseInt(hex.slice(1, 3), 16);
      expect(lum(palette.under0)).toBeLessThan(lum(palette.under1));
      expect(lum(palette.under1)).toBeLessThan(lum(palette.under2));
      expect(lum(palette.under2)).toBeLessThan(lum(palette.under3));
      // Grey only.
      for (const c of [palette.under0, palette.under1, palette.under2, palette.under3]) expect(c.slice(1, 3)).toBe(c.slice(3, 5));
    }
  });

  it('leaves out a layer that is switched off', () => {
    const on = layout(docWith(venue(HALL))).pages[0]!;
    const off = layout(withLayerHidden(docWith(venue(HALL)), 'Roof', true)).pages[0]!;
    const count = (ops: PlotOp[]) => segsOf(ops).reduce((n, o) => n + o.pts.length / 4, 0);
    expect(count(off.ops)).toBeLessThan(count(on.ops));
    const none = HALL.map(([name]) => name.replace(/ \d+$/, ''));
    let hidden = docWith(venue(HALL));
    for (const n of new Set(none)) hidden = withLayerHidden(hidden, n, true);
    expect(segsOf(layout(hidden).pages[0]!.ops)).toEqual([]);
  });

  it('is drawn as one path for each shade in the SVG, grey, in the screen and the print view', () => {
    const { pages } = layout(docWith(venue(HALL)));
    const screen = renderToStaticMarkup(<PlotSvg page={pages[0]!} palette={SCREEN_PALETTE} />);
    const print = renderToStaticMarkup(<PlotSvg page={pages[0]!} palette={PRINT_PALETTE} rotated />);
    const shades = segsOf(pages[0]!.ops).length;
    expect(screen.match(/<path /g)?.length).toBe(shades);
    expect(print.match(/<path /g)?.length).toBe(shades);
    expect(screen).toContain('stroke-width="0.1"');
    expect(print).toContain('matrix(0 -1 1 0 0 284)');
    expect(PLOT_W_MM).toBe(284);
    expect(PLOT_H_MM).toBe(198);
  });

  it('stays quick with six thousand lines', () => {
    const blocks = Array.from({ length: 6000 }, (_, i) => [`Detail ${i + 1}`, [[-25 + (i % 200) * 0.25, -5 + Math.floor(i / 200) * 2, (i % 9) / 2], [-24.8 + (i % 200) * 0.25, -4.5 + Math.floor(i / 200) * 2, (i % 9) / 2]]] as [string, [number, number, number][]]);
    const doc = docWith(venue(blocks));
    const started = performance.now();
    const { pages } = layout(doc);
    const ms = performance.now() - started;
    expect(segsOf(pages[0]!.ops).reduce((n, o) => n + o.pts.length / 4, 0)).toBeGreaterThan(4000);
    expect(ms).toBeLessThan(15000);
  }, 30000);
});

describe('the venue in the PDF', () => {
  const footer = printFooter({ appVersion: '0.1.0', soundvisionVersion: '2026.3.1', fileName: null, defaultName: 'x.arraysheet.json', dirty: true, printedAt: new Date(2026, 9, 22, 9, 5), verb: 'Exported' });

  it('is in the plot page, under the rest, and the PDF still opens', async () => {
    const plain = docWith(null);
    const withHall = docWith(venue(HALL));
    const a = await renderPdf({ doc: plain, model: sheetModel(plain, false), footer, checks: 0 });
    const b = await renderPdf({ doc: withHall, model: sheetModel(withHall, false), footer, checks: 0 });
    expect(b.length).toBeGreaterThan(a.length);
    expect((await PDFDocument.load(b)).getPageCount()).toBe((await PDFDocument.load(a)).getPageCount());
  });
});

describe('the venue in the DXF', () => {
  const dxf = (doc: Doc, on: boolean) => {
    const content = plotContent(doc, sheetModel(doc, false))!;
    return plotDxf({ ...content, footer: () => '' }, estimateWidth, { venue: on })!;
  };

  it('is left out unless asked for', () => {
    const doc = docWith(venue(HALL));
    expect(dxf(doc, false)).not.toContain('VENUE_');
    expect(dxf(doc, true)).toContain('VENUE_Walls');
  });

  it('puts each SketchUp layer on a layer of its own, with every line at full size in millimetres and a grey for its height', () => {
    const text = dxf(docWith(venue(HALL)), true);
    const lines = text.split('\r\n');
    const names = new Set<string>();
    for (let i = 0; i + 1 < lines.length; i += 2) if (lines[i] === '2' && lines[i + 1]!.startsWith('VENUE_')) names.add(lines[i + 1]!);
    expect([...names].sort()).toEqual(['VENUE_Roof', 'VENUE_Walls']);
    // The wall at X = 30 m is 30000 mm; the file is in centimetres internally.
    expect(text).toContain('\r\n10\r\n30000\r\n');
    // Entities carry their own grey (AutoCAD colours 251 to 254).
    const colours = new Set<string>();
    for (let i = 0; i + 3 < lines.length; i++) if (lines[i] === '8' && lines[i + 1]!.startsWith('VENUE_') && lines[i + 2] === '62') colours.add(lines[i + 3]!);
    for (const c of colours) expect(['251', '252', '253', '254']).toContain(c);
    expect(colours.size).toBeGreaterThan(0);
  });

  it('writes every line, also the ones that are off the plot page', () => {
    const text = dxf(docWith(venue([...HALL, ...far(40)])), true);
    const trees = text.split('\r\n').filter((l) => l === 'VENUE_Trees').length;
    expect(trees).toBeGreaterThanOrEqual(40);
  });

  it('writes a big venue whole, with the file still closed properly', () => {
    const blocks = Array.from({ length: 25000 }, (_, i) => [`Detail ${i + 1}`, [[-200 + (i % 500) * 0.8, -100 + Math.floor(i / 500) * 2, (i % 11)], [-199.5 + (i % 500) * 0.8, -99.5 + Math.floor(i / 500) * 2, (i % 11)]]] as [string, [number, number, number][]]);
    const text = dxf(docWith(venue(blocks)), true);
    const CRLF = String.fromCharCode(13, 10);
    expect(text.endsWith(`0${CRLF}EOF${CRLF}`)).toBe(true);
    expect(text.split(CRLF).filter((l) => l === 'VENUE_Detail').length).toBe(25000 + 1); // every line, and the layer in the layer table
  }, 60000);

  it('leaves out a layer that is switched off, and keeps layer names valid and different', () => {
    const doc = withLayerHidden(docWith(venue([['Wall/Left 01', [[0, 0, 0], [3, 0, 0]]], ['Wall Left 01', [[0, 1, 0], [3, 1, 0]]], ['Roof 01', [[0, 2, 0], [3, 2, 0]]]])), 'Roof', true);
    const text = dxf(doc, true);
    expect(text).not.toContain('VENUE_Roof');
    const names = [...new Set(text.split('\r\n').filter((l) => l.startsWith('VENUE_')))];
    expect(names.length).toBe(2);
    for (const n of names) expect(n).toMatch(/^[A-Za-z0-9_$-]{1,31}$/);
  });
});
