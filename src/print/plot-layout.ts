// The rigging plot page as drawing steps, in millimetres on a landscape A4 printable area (284 by 198 mm). Pure, so
// the print view, the on-screen preview and the PDF draw the same thing. The page is printed turned a quarter turn
// anticlockwise onto the portrait sheet; the renderers do that turn, nothing here knows about it.

import { minus } from '../engine/sheet';
import { type PlotArray, type PlotPoint, type Pt2 } from '../engine/plot';
import { NOT_STATED } from '../ui/format';
import { clipMiddle, clipToWidth, wrap, type Measure } from './array-image';
import { PT_PER_MM } from './pdf-layout';
import { PLOT_SMALL_PRINT } from './small-print';

export const PLOT_W_MM = 284;
export const PLOT_H_MM = 198;

export type PlotColor = 'ink' | 'grey' | 'grid' | 'dot' | 'axisX' | 'axisY';

export type PlotOp =
  | { op: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; color: PlotColor; dash?: number[] }
  | { op: 'circle'; cx: number; cy: number; r: number; width: number; color: PlotColor; fill: boolean }
  | { op: 'text'; x: number; y: number; text: string; size: number; bold: boolean; align: 'left' | 'center' | 'right'; color: PlotColor };

export type PlotPalette = Record<PlotColor, string>;

/** On screen the axes are red and green and the array Position is red. */
export const SCREEN_PALETTE: PlotPalette = { ink: '#000000', grey: '#555555', grid: '#d6d6d6', dot: '#d00000', axisX: '#d00000', axisY: '#0a8a0a' };
/** On paper the axes are black and grey and the dot is black. */
export const PRINT_PALETTE: PlotPalette = { ink: '#000000', grey: '#555555', grid: '#d0d0d0', dot: '#000000', axisX: '#000000', axisY: '#555555' };

/** The standard ratios, 1:n, the plot may use. The largest drawing that fits is chosen. */
export const STANDARD_RATIOS = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 2500];
export const GRID_M = 10;
/** A pickup marker is 250 mm across in the real world, but never smaller than this on paper. */
export const MARKER_REAL_M = 0.25;
export const MARKER_MIN_MM = 2;
/** Points above this many go on a second page. */
export const PLOT_TABLE_ROWS = 24;
const CONTINUED_ROWS = 40;

export const CHECK_BAR_MM = 100;
export const CHECK_BAR_TEXT = 'This bar is 100 mm long when printed at 100 percent. Measure it to check the scale.';
export const DOWNLOAD_NOTE = 'For the right scale, print the file from Download PDF at 100 percent.';

// The page, in millimetres.
const FRAME = { x0: 0, y0: 15, x1: 210, y1: 176 };
const COLUMN = { x0: 214, w: 70 };
const COLUMN_WIDTHS = [7, 23, 8.2, 9, 7.6, 7.6, 7.6];
const COLUMN_HEADS = ['Point', 'Array', 'Pickup', 'Load kg', 'Symbol', 'X (m)', 'Y (m)'];
const ROW_MM = 4;
/** An array name that needs a second line adds this much to its row. */
const TABLE_LINE_MM = 2.1;
const TABLE_PT = 5;
const PAD = { left: 8, right: 26, top: 8, bottom: 9 };
const FOOTER_Y = 192.5;
/** No label is wider than this, so one long name cannot run across the plan. */
const LABEL_MAX_MM = 60;

export interface PlotInput {
  arrays: readonly PlotArray[];
  points: readonly PlotPoint[];
  /** Flown arrays left out because the report lacks a position, size or azimuth. */
  notDrawn: readonly string[];
  /** Ground offset by position in the report, in metres. Null when what was typed is not a number. */
  offsets: Readonly<Record<number, number | null>>;
  /** The note typed as Origin (P0), e.g. "DSE". */
  origin: string;
  /** Name the sides of the plan (House left, House right, Stage, Audience). Off for a show in the round. */
  sideLabels: boolean;
  /** The line under the heading: show, venue and Z-axis zero. */
  subtitle: string;
  /** e.g. "Draft Rev B". */
  status: string;
  /** The footer for page n of the plot pages, counting from 0. */
  footer: (page: number) => string;
}

export interface PlotPage {
  ops: PlotOp[];
  /** The scale as 1:n. Zero on a page that continues the table. */
  ratio: number;
  /** True when the drawing does not fit even at the smallest scale, or the side column runs out of room. */
  overflow: boolean;
}

/** Metres, two decimals, with the ground-offset height in brackets when an offset is set. */
export function heightText(z: number, offset: number | null | undefined): string {
  const base = `${z.toFixed(2)} m`;
  if (offset === null || offset === undefined || offset === 0) return base;
  const corrected = minus(z, offset);
  return corrected === null ? base : `${base} (${corrected.toFixed(2)} m)`;
}

export function chooseRatio(widthM: number, heightM: number, availWMm: number, availHMm: number): { ratio: number; fits: boolean } {
  const need = Math.max(widthM / availWMm, heightM / availHMm) * 1000;
  const ratio = STANDARD_RATIOS.find((r) => r >= need);
  return ratio === undefined ? { ratio: STANDARD_RATIOS[STANDARD_RATIOS.length - 1] ?? 2500, fits: false } : { ratio, fits: true };
}

export const markerSizeMm = (ratio: number) => Math.max(MARKER_MIN_MM, (MARKER_REAL_M * 1000) / ratio);

/** The longest round length that is at most `maxMm` long at this scale, in metres. */
export function scaleBarMetres(mmPerM: number, maxMm: number): number {
  const choices = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  let best = choices[0] ?? 1;
  for (const c of choices) if (c * mmPerM <= maxMm) best = c;
  return best;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlap = (a: Rect, b: Rect, gap = 0.3) => a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;
const rectAround = (x: number, y: number, r: number): Rect => ({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });

interface LabelRequest {
  anchor: Rect;
  lines: { text: string; bold: boolean }[];
  /** Occupied rects this label is allowed to cover (its own array). */
  ignore?: Rect[];
  /** Draws the label closer to the anchor than the usual gap. */
  gap?: number;
}

interface PlacedLabel {
  box: Rect;
  lines: LabelRequest['lines'];
  /** Where the leader line starts and ends, or null when the label sits against its anchor. */
  leader: [Pt2, Pt2] | null;
}

const LABEL_PT = 5.5;
const LINE_MM = (LABEL_PT / PT_PER_MM) * 1.18;

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Origin lines and leader lines get stricter treatment than array edges. */
  kind?: 'origin' | 'leader';
}

/** Whether two segments cross (touching at an end does not count). */
function segmentsCross(a: Seg, b: Seg): boolean {
  const d = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d1 = d(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d2 = d(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const d3 = d(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d4 = d(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

/** Whether a segment passes through a rectangle (Liang-Barsky). */
function segmentHitsRect(sg: Seg, r: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = sg.x2 - sg.x1;
  const dy = sg.y2 - sg.y1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, sg.x1 - r.x0) && clip(dx, r.x1 - sg.x1) && clip(-dy, sg.y1 - r.y0) && clip(dy, r.y1 - sg.y1);
}

const inflate = (r: Rect, g: number): Rect => ({ x0: r.x0 - g, y0: r.y0 - g, x1: r.x1 + g, y1: r.y1 + g });

/** Directions tried at each distance: sides first, then slid sideways, then the corners. */
const DIRECTIONS = ['R', 'L', 'T', 'B', 'RU', 'RD', 'LU', 'LD', 'TR', 'TL', 'BR', 'BL'] as const;
/** The rects that are labels, so a leader may start under a marker or box but not through another label. */
const placedLabels = new WeakSet<Rect>();
const DISTANCES = [0, 2, 4, 6, 8, 11, 14, 18, 23, 29, 36, 44];

/**
 * Each label takes the first spot, nearest and tidiest first, where it covers no marker, label or line (the origin
 * lines, array edges and front to rear lines count as lines). Further out it gets a leader line, which must not cross
 * anything either. If every spot clashes, the one with the fewest clashes is used. Placed labels and leaders become
 * obstacles for the next ones.
 */
function placeLabels(requests: readonly LabelRequest[], occupied: Rect[], soft: ReadonlySet<Rect>, segments: Seg[], bounds: Rect, measure: Measure): PlacedLabel[] {
  const out: PlacedLabel[] = [];
  for (const request of requests) {
    const req = { ...request, lines: request.lines.map((l) => ({ ...l, text: clipToWidth(l.text, LABEL_PT, l.bold, LABEL_MAX_MM * PT_PER_MM, measure) })) };
    const w = Math.max(...req.lines.map((l) => measure(l.text, LABEL_PT, l.bold))) / PT_PER_MM + 0.8;
    const h = req.lines.length * LINE_MM + 0.4;
    const a = req.anchor;
    const cx = (a.x0 + a.x1) / 2;
    const cy = (a.y0 + a.y1) / 2;
    const gap = req.gap ?? 0.6;
    const at = (x0: number, y0: number): Rect => ({ x0, y0, x1: x0 + w, y1: y0 + h });
    const spot = (dir: (typeof DIRECTIONS)[number], d: number): Rect => {
      switch (dir) {
        case 'R': return at(a.x1 + d, cy - h / 2);
        case 'L': return at(a.x0 - d - w, cy - h / 2);
        case 'T': return at(cx - w / 2, a.y0 - d - h);
        case 'B': return at(cx - w / 2, a.y1 + d);
        case 'RU': return at(a.x1 + d, cy - h);
        case 'RD': return at(a.x1 + d, cy);
        case 'LU': return at(a.x0 - d - w, cy - h);
        case 'LD': return at(a.x0 - d - w, cy);
        case 'TR': return at(a.x1 + d, a.y0 - d - h);
        case 'TL': return at(a.x0 - d - w, a.y0 - d - h);
        case 'BR': return at(a.x1 + d, a.y1 + d);
        default: return at(a.x0 - d - w, a.y1 + d);
      }
    };
    const candidates: { box: Rect; far: boolean }[] = [];
    for (const dist of DISTANCES) for (const dir of DIRECTIONS) candidates.push({ box: spot(dir, dist === 0 ? gap : gap + dist), far: dist > 0 });
    const inBounds = (r: Rect) => r.x0 >= bounds.x0 && r.y0 >= bounds.y0 && r.x1 <= bounds.x1 && r.y1 <= bounds.y1;
    const leaderFor = (r: Rect): Seg => ({ x1: cx, y1: cy, x2: Math.min(Math.max(cx, r.x0), r.x1), y2: Math.min(Math.max(cy, r.y0), r.y1) });
    const clashes = (c: { box: Rect; far: boolean }): number => {
      // Covering another label or marker is worst, crossing a line next, sitting in an array's bounding box (which a turned box over-states) least.
      let n = 0;
      for (const o of occupied) if (!req.ignore?.includes(o) && overlap(c.box, o)) n += soft.has(o) ? 1 : 10;
      const padded = inflate(c.box, 0.25);
      n += segments.filter((sg) => segmentHitsRect(sg, padded)).reduce((sum, sg) => sum + (sg.kind === 'leader' ? 9 : 3), 0);
      if (c.far) {
        const l = leaderFor(c.box);
        const startsIn = (o: Rect) => cx >= o.x0 && cx <= o.x1 && cy >= o.y0 && cy <= o.y1;
        n += 9 * occupied.filter((o) => !soft.has(o) && o !== a && !req.ignore?.includes(o) && !startsIn(o) && (placedLabels.has(o) || !overlap(a, o, 0)) && segmentHitsRect(l, o)).length;
        n += 4 * segments.filter((sg) => (sg.kind === 'origin' || sg.kind === 'leader') && segmentsCross(l, sg)).length;
        // Between equals, the shorter leader wins.
        n += Math.hypot(l.x2 - l.x1, l.y2 - l.y1) * 0.01;
      }
      return n;
    };
    const fits = candidates.filter((c) => inBounds(c.box));
    let best: { box: Rect; far: boolean } | undefined;
    let bestCost = Infinity;
    for (const c of fits) {
      const cost = clashes(c);
      if (cost < bestCost) {
        best = c;
        bestCost = cost;
        if (cost === 0) break;
      }
    }
    // Nothing fits in the frame at all: nudge the first spot back in.
    let chosen: Rect;
    let far: boolean;
    if (best) {
      chosen = best.box;
      far = best.far;
    } else {
      const b = (candidates[0] as { box: Rect }).box;
      const dx = Math.max(0, bounds.x0 - b.x0) - Math.max(0, b.x1 - bounds.x1);
      const dy = Math.max(0, bounds.y0 - b.y0) - Math.max(0, b.y1 - bounds.y1);
      chosen = { x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy };
      far = true;
    }
    occupied.push(chosen);
    placedLabels.add(chosen);
    let leaderLine: [Pt2, Pt2] | null = null;
    if (far) {
      const l = leaderFor(chosen);
      leaderLine = [{ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }];
      segments.push({ ...l, kind: 'leader' });
    }
    out.push({ box: chosen, lines: req.lines, leader: leaderLine });
  }
  return out;
}

const text = (x: number, y: number, t: string, size: number, o: { bold?: boolean; align?: 'left' | 'center' | 'right'; color?: PlotColor } = {}): PlotOp => ({
  op: 'text',
  x,
  y,
  text: t,
  size,
  bold: o.bold ?? false,
  align: o.align ?? 'left',
  color: o.color ?? 'ink',
});
const line = (x1: number, y1: number, x2: number, y2: number, width: number, color: PlotColor = 'ink', dash?: number[]): PlotOp =>
  dash ? { op: 'line', x1, y1, x2, y2, width, color, dash } : { op: 'line', x1, y1, x2, y2, width, color };

/** A pickup marker: a circle with a cross, centred on the pickup. Phase one draws the 1 ton symbol everywhere. */
function marker(ops: PlotOp[], x: number, y: number, d: number, width = 0.22) {
  const r = d / 2;
  ops.push({ op: 'circle', cx: x, cy: y, r, width, color: 'ink', fill: false });
  ops.push(line(x - r, y, x + r, y, width), line(x, y - r, x, y + r, width));
}

function arrow(ops: PlotOp[], x1: number, y1: number, x2: number, y2: number, color: PlotColor) {
  ops.push(line(x1, y1, x2, y2, 0.45, color));
  const a = Math.atan2(y2 - y1, x2 - x1);
  for (const s of [-1, 1]) ops.push(line(x2, y2, x2 - 2.2 * Math.cos(a + s * 0.45), y2 - 2.2 * Math.sin(a + s * 0.45), 0.45, color));
}

const headerOps = (input: PlotInput, title: string, ratio: number, measure: Measure): PlotOp[] => {
  const ops: PlotOp[] = [text(0, 0, title, 14, { bold: true })];
  if (input.subtitle) ops.push(text(0, 7.3, clipToWidth(input.subtitle, 8, false, PLOT_W_MM * PT_PER_MM, measure), 8));
  ops.push(text(PLOT_W_MM, 0.4, input.status.toUpperCase(), 6, { bold: true, align: 'right' }));
  ops.push(text(PLOT_W_MM, 3.8, ratio > 0 ? `Plan view, scale 1:${ratio}` : 'Plan view', 6, { align: 'right' }));
  return ops;
};

function footerOps(input: PlotInput, page: number, measure: Measure): PlotOp[] {
  const t = clipToWidth(input.footer(page), 6, false, PLOT_W_MM * PT_PER_MM, measure);
  return [text(PLOT_W_MM / 2, FOOTER_Y, t, 6, { align: 'center' })];
}

/** The table rows as strings. */
export function tableRow(p: PlotPoint): string[] {
  return [p.label, p.source, p.which === 'front' ? 'Front' : 'Rear', p.load === null ? NOT_STATED : String(p.load), '1 t', p.at.x.toFixed(2), p.at.y.toFixed(2)];
}

/** The array name on at most two lines, cut in the middle of the second if it is still too long. */
export function tableNameLines(name: string, measure: Measure): string[] {
  const max = (COLUMN_WIDTHS[1] ?? 0) - 1.2;
  const lines = wrap(name, TABLE_PT, false, max * PT_PER_MM, measure);
  if (lines.length <= 2) return lines.length > 0 ? lines : [''];
  return [lines[0] as string, clipMiddle(lines.slice(1).join(' '), TABLE_PT, false, max * PT_PER_MM, measure)];
}

function tableOps(rows: readonly PlotPoint[], x0: number, y0: number, measure: Measure): { ops: PlotOp[]; bottom: number } {
  const ops: PlotOp[] = [];
  const xs = COLUMN_WIDTHS.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? x0) + w], [x0]);
  const right = (i: number) => i >= 3;
  const cell = (i: number, t: string, y: number, bold: boolean) => {
    const w = (COLUMN_WIDTHS[i] ?? 0) - 1.2;
    const clipped = clipToWidth(t, TABLE_PT, bold, w * PT_PER_MM, measure);
    ops.push(text(right(i) ? (xs[i + 1] ?? 0) - 0.6 : (xs[i] ?? 0) + 0.6, y + 0.9, clipped, TABLE_PT, { bold, align: right(i) ? 'right' : 'left' }));
  };
  let y = y0;
  COLUMN_HEADS.forEach((h, i) => cell(i, h, y, true));
  y += ROW_MM;
  ops.push(line(x0, y, x0 + COLUMN.w, y, 0.3, 'ink'));
  for (const p of rows) {
    const names = tableNameLines(p.source, measure);
    tableRow(p).forEach((t, i) => {
      if (i !== 1) cell(i, t, y, i === 0);
    });
    names.forEach((n, k) => ops.push(text((xs[1] ?? 0) + 0.6, y + 0.9 + k * TABLE_LINE_MM, n, TABLE_PT)));
    y += ROW_MM + (names.length - 1) * TABLE_LINE_MM;
    ops.push(line(x0, y, x0 + COLUMN.w, y, 0.15, 'grey'));
  }
  return { ops, bottom: y };
}

/** One bounding box of everything that has to be on the plan, in metres. */
function extent(input: PlotInput): { x0: number; y0: number; x1: number; y1: number } {
  const xs: number[] = [0];
  const ys: number[] = [0];
  for (const a of input.arrays) {
    for (const c of a.corners) {
      xs.push(c.x);
      ys.push(c.y);
    }
    xs.push(a.position.x);
    ys.push(a.position.y);
  }
  for (const p of input.points) {
    xs.push(p.at.x);
    ys.push(p.at.y);
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function dashedBox(ops: PlotOp[], pts: Pt2[], solid: boolean) {
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length] as Pt2;
    ops.push(line(p.x, p.y, q.x, q.y, 0.25, 'ink', solid ? undefined : [1.6, 1]));
  });
}

export function layoutPlotPages(input: PlotInput, measure: Measure): PlotPage[] {
  const pages: PlotPage[] = [];
  const first = input.points.slice(0, PLOT_TABLE_ROWS);
  const more = input.points.slice(PLOT_TABLE_ROWS);

  // ---- The plan ----
  const ops: PlotOp[] = [];
  const e = extent(input);
  const availW = FRAME.x1 - FRAME.x0 - PAD.left - PAD.right;
  const availH = FRAME.y1 - FRAME.y0 - PAD.top - PAD.bottom;
  const wM = Math.max(e.x1 - e.x0, GRID_M);
  const hM = Math.max(e.y1 - e.y0, GRID_M);
  const { ratio, fits } = chooseRatio(wM, hM, availW, availH);
  const s = 1000 / ratio; // millimetres on paper per metre
  const cxAvail = FRAME.x0 + PAD.left + availW / 2;
  const cyAvail = FRAME.y0 + PAD.top + availH / 2;
  const ox = cxAvail - ((e.x0 + e.x1) / 2) * s;
  const oy = cyAvail + ((e.y0 + e.y1) / 2) * s;
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy - y * s;
  const bounds: Rect = { x0: FRAME.x0 + 0.8, y0: FRAME.y0 + 0.8, x1: FRAME.x1 - 0.8, y1: FRAME.y1 - 0.8 };
  // When even the smallest scale is too small, what falls outside the frame is left off and named, not drawn over the table.
  const inside = (x: number, y: number) => X(x) >= bounds.x0 && X(x) <= bounds.x1 && Y(y) >= bounds.y0 && Y(y) <= bounds.y1;
  const arrays = fits ? input.arrays : input.arrays.filter((a) => a.corners.every((c) => inside(c.x, c.y)) && inside(a.position.x, a.position.y));
  const kept = new Set(arrays.map((a) => a.index));
  const points = fits ? input.points : input.points.filter((p) => kept.has(p.arrayIndex) && inside(p.at.x, p.at.y));
  const offPage = input.arrays.filter((a) => !kept.has(a.index)).map((a) => a.name);

  ops.push(...headerOps(input, 'Rigging plot', ratio, measure));

  // Grid every 10 m in world coordinates, then the frame.
  for (let gx = Math.ceil((FRAME.x0 - ox) / s / GRID_M) * GRID_M; X(gx) <= FRAME.x1; gx += GRID_M) {
    if (gx !== 0) ops.push(line(X(gx), FRAME.y0, X(gx), FRAME.y1, 0.12, 'grid'));
  }
  for (let gy = Math.ceil((oy - FRAME.y1) / s / GRID_M) * GRID_M; Y(gy) >= FRAME.y0; gy += GRID_M) {
    if (gy !== 0) ops.push(line(FRAME.x0, Y(gy), FRAME.x1, Y(gy), 0.12, 'grid'));
  }
  const edge = 0.2;
  ops.push(
    line(FRAME.x0 + edge, FRAME.y0, FRAME.x1, FRAME.y0, 0.4),
    line(FRAME.x1, FRAME.y0, FRAME.x1, FRAME.y1, 0.4),
    line(FRAME.x1, FRAME.y1, FRAME.x0 + edge, FRAME.y1, 0.4),
    line(FRAME.x0 + edge, FRAME.y1, FRAME.x0 + edge, FRAME.y0, 0.4),
  );

  const occupied: Rect[] = [];
  const segments: Seg[] = [];

  // The origin: dash-dot lines across the plan, its note, and the two axes.
  const ox0 = X(0);
  const oy0 = Y(0);
  ops.push(line(FRAME.x0, oy0, FRAME.x1, oy0, 0.25, 'ink', [4, 1, 0.8, 1]), line(ox0, FRAME.y0, ox0, FRAME.y1, 0.25, 'ink', [4, 1, 0.8, 1]));
  segments.push({ x1: FRAME.x0, y1: oy0, x2: FRAME.x1, y2: oy0, kind: 'origin' }, { x1: ox0, y1: FRAME.y0, x2: ox0, y2: FRAME.y1, kind: 'origin' });
  arrow(ops, ox0, oy0, ox0 + 14, oy0, 'axisX');
  arrow(ops, ox0, oy0, ox0, oy0 - 14, 'axisY');
  ops.push(text(ox0 + 15, oy0 - 3.4, '+X', 6, { bold: true, color: 'axisX' }), text(ox0 + 1.2, oy0 - 18.6, '+Y', 6, { bold: true, color: 'axisY' }));
  const originFull = input.origin.trim() ? `Soundvision origin: ${input.origin.trim()}` : 'Soundvision origin';
  const originText = clipToWidth(originFull, 5.5, false, Math.max(20, FRAME.x1 - ox0 - 3) * PT_PER_MM - 1, measure);
  const originW = measure(originText, 5.5, false) / PT_PER_MM + 0.8;
  const originBox: Rect = { x0: ox0 + 1.2, y0: oy0 + 0.8, x1: ox0 + 1.2 + originW, y1: oy0 + 0.8 + LINE_MM };
  ops.push(text(originBox.x0 + 0.2, originBox.y0, originText, 5.5, { color: 'grey' }));
  occupied.push(inflate(originBox, 0.8), { x0: ox0, y0: oy0 - 14, x1: ox0 + 18, y1: oy0 + 0.5 }, { x0: ox0 - 0.5, y0: oy0 - 20, x1: ox0 + 4, y1: oy0 });

  // Which way is which.
  const sideSize = 6;
  const sideH = sideSize / PT_PER_MM;
  const centre = (FRAME.x0 + FRAME.x1) / 2;
  // The titles above and below the plan keep clear of the vertical origin line.
  const clear = (t: string) => {
    const half = measure(t, sideSize, true) / PT_PER_MM / 2 + 2;
    return Math.abs(X(0) - centre) < half ? X(0) + half + 1 : centre;
  };
  const sides: [string, number, number, 'left' | 'center' | 'right'][] = [
    ['House left', FRAME.x1 - 1.5, FRAME.y0 + 1.2, 'right'],
    ['House right', FRAME.x0 + 1.5, FRAME.y0 + 1.2, 'left'],
    ['Audience', clear('Audience'), FRAME.y0 + 1.2, 'center'],
    ['Stage', clear('Stage'), FRAME.y1 - sideH - 1.2, 'center'],
  ];
  for (const [t, x, y, align] of input.sideLabels ? sides : []) {
    ops.push(text(x, y, t, sideSize, { bold: true, align, color: 'grey' }));
    const w = measure(t, sideSize, true) / PT_PER_MM;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    occupied.push({ x0, y0: y, x1: x0 + w, y1: y + sideH });
  }

  // Array boxes and their Position dots.
  const d = markerSizeMm(ratio);
  const boxRects = new Map<number, Rect>();
  for (const a of arrays) {
    const pts = a.corners.map((c) => ({ x: X(c.x), y: Y(c.y) }));
    dashedBox(ops, pts, a.pickups.length === 0);
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length] as Pt2;
      segments.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });
    });
    const rect: Rect = {
      x0: Math.min(...pts.map((p) => p.x)),
      y0: Math.min(...pts.map((p) => p.y)),
      x1: Math.max(...pts.map((p) => p.x)),
      y1: Math.max(...pts.map((p) => p.y)),
    };
    boxRects.set(a.index, rect);
    ops.push({ op: 'circle', cx: X(a.position.x), cy: Y(a.position.y), r: 0.55, width: 0.1, color: 'dot', fill: true });
    occupied.push(rectAround(X(a.position.x), Y(a.position.y), 0.9));
  }
  const markerRects: Rect[] = [];
  for (const p of points) markerRects.push(rectAround(X(p.at.x), Y(p.at.y), d / 2 + 0.2));
  const softRects = new Set<Rect>(boxRects.values());
  for (const r of boxRects.values()) occupied.push(r);
  occupied.push(...markerRects);

  // Front to rear lines, then the markers on top of them.
  const byArray = new Map<number, PlotPoint[]>();
  for (const p of points) byArray.set(p.arrayIndex, [...(byArray.get(p.arrayIndex) ?? []), p]);
  for (const list of byArray.values()) {
    const f = list.find((p) => p.which === 'front');
    const r = list.find((p) => p.which === 'rear');
    if (f && r) {
      ops.push(line(X(f.at.x), Y(f.at.y), X(r.at.x), Y(r.at.y), 0.2, 'grey'));
      segments.push({ x1: X(f.at.x), y1: Y(f.at.y), x2: X(r.at.x), y2: Y(r.at.y) });
    }
  }
  for (const p of points) marker(ops, X(p.at.x), Y(p.at.y), d);

  // Labels: pickups first, then arrays, then the total weight on each front to rear line.
  const weightRequests: LabelRequest[] = [];
  for (const list of byArray.values()) {
    const f = list.find((p) => p.which === 'front');
    const r = list.find((p) => p.which === 'rear');
    const total = arrays.find((a) => a.index === f?.arrayIndex)?.totalWeight;
    if (!f || !r || total === null || total === undefined) continue;
    const mx = (X(f.at.x) + X(r.at.x)) / 2;
    const my = (Y(f.at.y) + Y(r.at.y)) / 2;
    weightRequests.push({ anchor: rectAround(mx, my, 0.3), lines: [{ text: `${total} kg`, bold: false }], gap: 1.6 });
  }
  const weightLabels = placeLabels(weightRequests, occupied, softRects, segments, bounds, measure);
  const requests: LabelRequest[] = points.map((p, i) => ({
    anchor: markerRects[i] as Rect,
    ignore: [boxRects.get(p.arrayIndex)].filter((r): r is Rect => !!r),
    lines: [
      { text: `${p.label}  ${p.load === null ? 'load not stated' : `${p.load} kg`}`, bold: true },
      { text: heightText(p.at.z, input.offsets[p.arrayIndex]), bold: false },
    ],
  }));
  const pointLabels = placeLabels(requests, occupied, softRects, segments, bounds, measure);
  const arrayRequests: LabelRequest[] = arrays.map((a) => {
    const lines = [{ text: a.name, bold: true }];
    if (a.topSite !== null) lines.push({ text: `Top site ${a.topSite}°`, bold: false });
    lines.push({ text: `Position Z ${heightText(a.position.z, input.offsets[a.index])}`, bold: false });
    const own = boxRects.get(a.index) as Rect;
    return { anchor: own, ignore: [own], lines, gap: 1.2 };
  });
  const arrayLabels = placeLabels(arrayRequests, occupied, softRects, segments, bounds, measure);
  const leaders: PlotOp[] = [];
  for (const l of [...pointLabels, ...arrayLabels, ...weightLabels]) {
    l.lines.forEach((t, i) => ops.push(text(l.box.x0 + 0.4, l.box.y0 + 0.2 + i * LINE_MM, t.text, LABEL_PT, { bold: t.bold })));
    if (l.leader) leaders.push(line(l.leader[0].x, l.leader[0].y, l.leader[1].x, l.leader[1].y, 0.12, 'grey'));
  }
  ops.push(...leaders);

  // Scale bar, check bar and the notes under the plan.
  const barM = scaleBarMetres(s, 60);
  const barMm = barM * s;
  const scaleText = `Scale 1:${ratio}${fits ? '' : ' (does not fit; reduce the arrays drawn)'}`;
  const gridX = Math.max(34, measure(scaleText, 6, true) / PT_PER_MM + 4);
  ops.push(text(0, FRAME.y1 + 1.6, scaleText, 6, { bold: true }));
  ops.push(text(gridX, FRAME.y1 + 1.6, `Grid ${GRID_M} m`, 6, { color: 'grey' }));
  const barY = FRAME.y1 + 8;
  ops.push(line(1, barY, 1 + barMm, barY, 0.6), line(1, barY - 1.2, 1, barY + 1.2, 0.3), line(1 + barMm, barY - 1.2, 1 + barMm, barY + 1.2, 0.3));
  ops.push(text(1 + barMm + 2, barY - 1.2, `${barM} m`, 5.5));
  const checkX = 80;
  ops.push(line(checkX, barY, checkX + CHECK_BAR_MM, barY, 0.6), line(checkX, barY - 1.2, checkX, barY + 1.2, 0.3), line(checkX + CHECK_BAR_MM, barY - 1.2, checkX + CHECK_BAR_MM, barY + 1.2, 0.3));
  ops.push(text(checkX, barY + 1.6, CHECK_BAR_TEXT, 5));
  ops.push(text(0, barY + 5.2, DOWNLOAD_NOTE, 5));
  // What was left off, on the row of the scale text, clear of the footer.
  const left: string[] = [];
  if (input.notDrawn.length > 0) left.push(`Not drawn, no position, size or azimuth in the report: ${input.notDrawn.join(', ')}`);
  if (offPage.length > 0) left.push(`Off the page at this scale: ${offPage.join(', ')}`);
  if (left.length > 0) {
    const noteX = gridX + 24;
    ops.push(text(noteX, FRAME.y1 + 1.8, clipToWidth(left.join('. '), 5, false, (PLOT_W_MM - noteX) * PT_PER_MM, measure), 5));
  }

  // ---- The side column: table, legend, small print ----
  const tbl = tableOps(first, COLUMN.x0, FRAME.y0, measure);
  ops.push(...tbl.ops);
  let y = tbl.bottom + 4;
  const sw = 6;
  const legend: [() => void, string][] = [
    [() => dashedBox(ops, [{ x: COLUMN.x0, y: y }, { x: COLUMN.x0 + sw, y: y }, { x: COLUMN.x0 + sw, y: y + 2.4 }, { x: COLUMN.x0, y: y + 2.4 }], false), 'Array with pickups: width and depth from the report'],
    [() => dashedBox(ops, [{ x: COLUMN.x0, y: y }, { x: COLUMN.x0 + sw, y: y }, { x: COLUMN.x0 + sw, y: y + 2.4 }, { x: COLUMN.x0, y: y + 2.4 }], true), 'Array with no pickup'],
    [() => ops.push({ op: 'circle', cx: COLUMN.x0 + sw / 2, cy: y + 1.2, r: 0.55, width: 0.1, color: 'dot', fill: true }), 'Array Position'],
    [() => marker(ops, COLUMN.x0 + sw / 2, y + 1.2, 2.4), 'Pickup, 1 t symbol (a nominal guide only)'],
    [() => ops.push(line(COLUMN.x0, y + 1.2, COLUMN.x0 + sw, y + 1.2, 0.2, 'grey')), 'Front to rear pickup, with the total weight'],
  ];
  ops.push(text(COLUMN.x0, y, 'Key', 5.5, { bold: true }));
  y += 4.2;
  for (const [draw, label] of legend) {
    draw();
    ops.push(text(COLUMN.x0 + sw + 2, y + 0.2, clipToWidth(label, 5, false, (COLUMN.w - sw - 2) * PT_PER_MM, measure), 5));
    y += 4;
  }
  const small = wrap(PLOT_SMALL_PRINT, 5, false, COLUMN.w * PT_PER_MM, measure);
  const smallLine = (5 / PT_PER_MM) * 1.2;
  const smallTop = PLOT_H_MM - 6 - small.length * smallLine - 1;
  small.forEach((t, i) => ops.push(text(COLUMN.x0, smallTop + i * smallLine, t, 5)));
  const columnOverflow = y > smallTop;

  ops.push(...footerOps(input, 0, measure));
  pages.push({ ops, ratio, overflow: !fits || columnOverflow });

  // ---- Pages that continue the table ----
  for (let i = 0; i < more.length; i += CONTINUED_ROWS) {
    const rows = more.slice(i, i + CONTINUED_ROWS);
    const page = pages.length;
    const cont: PlotOp[] = [...headerOps(input, 'Rigging plot (continued)', 0, measure)];
    cont.push(...tableOps(rows, 0, FRAME.y0, measure).ops);
    cont.push(...footerOps(input, page, measure));
    pages.push({ ops: cont, ratio: 0, overflow: false });
  }
  return pages;
}

/** How many pages the plot takes for this many pickup points. */
export function plotPageCount(points: number): number {
  return 1 + Math.ceil(Math.max(0, points - PLOT_TABLE_ROWS) / CONTINUED_ROWS);
}
