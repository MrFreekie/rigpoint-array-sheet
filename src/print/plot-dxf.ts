// The rigging plot as a DXF file: the same arrays, pickups and labels as the plot page, at full size in millimetres
// (1:1), with the Soundvision origin at 0,0, +X towards house left and +Y towards the audience, so the coordinates are
// the report's own metres times 1000. Geometry comes straight from the report's figures; the labels keep the places the
// plot page gave them, scaled up to full size, so they clash no more than they do on the page.
// The file is plain ASCII in the old R12 layout, which every CAD program reads. It has no library behind it.

import { markerPrims } from '../engine/markers';
import { dotRadiusMm, layoutPlotPages, MARKER_REAL_M, type PlotInput, type PlotPlan } from './plot-layout';
import type { Measure } from './array-image';
import { PT_PER_MM } from './pdf-layout';
import { PLOT_SMALL_PRINT } from './small-print';

export const DXF_UNITS_NOTE = 'DXF units are millimetres at full size (1:1).';
export const DXF_MIME = 'application/dxf';

interface Layer {
  name: string;
  colour: number;
  linetype: 'CONTINUOUS' | 'DASHED' | 'DASHDOT';
}

/** AutoCAD colour index: 7 is white on a dark screen and black on paper, 8 grey, 1 red, 3 green. */
const LAYERS: Layer[] = [
  { name: 'ARRAYS', colour: 7, linetype: 'DASHED' },
  { name: 'ARRAYS_NO_PICKUP', colour: 7, linetype: 'CONTINUOUS' },
  { name: 'STACKS', colour: 7, linetype: 'CONTINUOUS' },
  { name: 'STACK_DIAGONALS', colour: 8, linetype: 'CONTINUOUS' },
  { name: 'POSITIONS', colour: 7, linetype: 'CONTINUOUS' },
  { name: 'PICKUPS', colour: 7, linetype: 'CONTINUOUS' },
  { name: 'PICKUPS_CUSTOM', colour: 8, linetype: 'CONTINUOUS' },
  { name: 'PICKUP_LINKS', colour: 8, linetype: 'CONTINUOUS' },
  { name: 'LABELS', colour: 7, linetype: 'CONTINUOUS' },
  { name: 'LEADERS', colour: 8, linetype: 'CONTINUOUS' },
  { name: 'ORIGIN', colour: 7, linetype: 'DASHDOT' },
  { name: 'AXIS_X', colour: 1, linetype: 'CONTINUOUS' },
  { name: 'AXIS_Y', colour: 3, linetype: 'CONTINUOUS' },
  { name: 'SIDES', colour: 8, linetype: 'CONTINUOUS' },
  { name: 'NOTES', colour: 7, linetype: 'CONTINUOUS' },
];

/** The greys of the venue lines, darkest for the lowest part: AutoCAD colours 251 to 254. */
const VENUE_ACI = [251, 252, 253, 254] as const;

/** Plain ASCII only: anything else is written as \U+XXXX, which CAD programs show as the character. */
export function dxfText(text: string): string {
  return Array.from(text.replace(/[\r\n]+/g, ' '))
    .map((ch) => {
      const c = ch.codePointAt(0) as number;
      return c >= 32 && c < 127 ? ch : `\\U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
    })
    .join('');
}

/** A number as DXF wants it: millimetres to a thousandth, no negative zero, no exponent. */
const num = (v: number): string => {
  const r = Math.round(v * 1000) / 1000 + 0;
  return Object.is(r, -0) ? '0' : String(r);
};

class Writer {
  private readonly out: string[] = [];
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;
  /** Group code and value, one per line pair. */
  g(code: number, value: string | number): void {
    this.out.push(String(code), typeof value === 'number' ? num(value) : value);
  }
  private grow(x: number, y: number): void {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
  }
  line(layer: string, x1: number, y1: number, x2: number, y2: number, colour?: number): void {
    this.g(0, 'LINE');
    this.g(8, layer);
    if (colour !== undefined) this.g(62, colour);
    this.g(10, x1);
    this.g(20, y1);
    this.g(30, 0);
    this.g(11, x2);
    this.g(21, y2);
    this.g(31, 0);
    this.grow(x1, y1);
    this.grow(x2, y2);
  }
  circle(layer: string, x: number, y: number, r: number): void {
    this.g(0, 'CIRCLE');
    this.g(8, layer);
    this.g(10, x);
    this.g(20, y);
    this.g(30, 0);
    this.g(40, r);
    this.grow(x - r, y - r);
    this.grow(x + r, y + r);
  }
  /** Text with its left end on the baseline at (x, y). `height` is the height of a capital letter. */
  text(layer: string, x: number, y: number, height: number, value: string, width = 0): void {
    this.g(0, 'TEXT');
    this.g(8, layer);
    this.g(10, x);
    this.g(20, y);
    this.g(30, 0);
    this.g(40, height);
    this.g(1, dxfText(value));
    this.grow(x, y);
    this.grow(x + width, y + height);
  }
  lines(): string[] {
    return this.out;
  }
}

/** The long dashes of an array box, in millimetres. */
const DASH = { dashed: [300, 150], dashDot: [600, 200, 0, 200] } as const;

function header(ext: { minX: number; minY: number; maxX: number; maxY: number }, note: string, layers: readonly Layer[]): string[] {
  const h: string[] = [];
  const g = (code: number, value: string | number) => h.push(String(code), typeof value === 'number' ? num(value) : value);
  g(999, 'RigPoint Array rigging plot');
  g(999, DXF_UNITS_NOTE);
  g(999, note);
  g(0, 'SECTION');
  g(2, 'HEADER');
  g(9, '$ACADVER');
  g(1, 'AC1009');
  g(9, '$INSUNITS');
  g(70, 4);
  g(9, '$MEASUREMENT');
  g(70, 1);
  g(9, '$LUNITS');
  g(70, 2);
  g(9, '$LUPREC');
  g(70, 0);
  g(9, '$LTSCALE');
  g(40, 1);
  g(9, '$EXTMIN');
  g(10, ext.minX);
  g(20, ext.minY);
  g(30, 0);
  g(9, '$EXTMAX');
  g(10, ext.maxX);
  g(20, ext.maxY);
  g(30, 0);
  g(0, 'ENDSEC');
  g(0, 'SECTION');
  g(2, 'TABLES');
  g(0, 'TABLE');
  g(2, 'LTYPE');
  g(70, 3);
  const ltype = (name: string, description: string, pattern: readonly number[]) => {
    g(0, 'LTYPE');
    g(2, name);
    g(70, 0);
    g(3, description);
    g(72, 65);
    g(73, pattern.length);
    g(40, pattern.reduce((sum, v) => sum + v, 0));
    pattern.forEach((v, i) => g(49, i % 2 === 0 ? v : -v));
  };
  ltype('CONTINUOUS', 'Solid line', []);
  ltype('DASHED', 'Dashed', DASH.dashed);
  ltype('DASHDOT', 'Dash dot', DASH.dashDot);
  g(0, 'ENDTAB');
  g(0, 'TABLE');
  g(2, 'LAYER');
  g(70, layers.length);
  for (const l of layers) {
    g(0, 'LAYER');
    g(2, l.name);
    g(70, 0);
    g(62, l.colour);
    g(6, l.linetype);
  }
  g(0, 'ENDTAB');
  g(0, 'TABLE');
  g(2, 'STYLE');
  g(70, 1);
  g(0, 'STYLE');
  g(2, 'STANDARD');
  g(70, 0);
  g(40, 0);
  g(41, 1);
  g(50, 0);
  g(71, 0);
  g(42, 0.2);
  g(3, 'txt');
  g(4, '');
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  return h;
}

/** Wraps text at spaces to at most `max` characters a line. */
export function wrapChars(text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line !== '' && line.length + 1 + word.length > max) {
      out.push(line);
      line = word;
    } else {
      line = line === '' ? word : `${line} ${word}`;
    }
  }
  if (line !== '') out.push(line);
  return out;
}

/**
 * The plot as DXF text, or null when nothing can be drawn. Coordinates are millimetres: the report's metres times 1000,
 * origin at 0,0, +X towards house left. `measure` is the one the plot page uses, so the labels sit where the page puts them.
 */
export function plotDxf(input: PlotInput, measure: Measure, options: { venue?: boolean } = {}): string | null {
  if (input.arrays.length === 0) return null;
  const page = layoutPlotPages(input, measure)[0];
  const plan = page?.plan;
  if (!plan) return null;
  const w = new Writer();
  const mm = (m: number) => m * 1000;

  // The venue first, if asked: every line, not only those inside the plot frame, at full size (the lines are in centimetres, so times 10 for millimetres). Each SketchUp layer is a layer of its own.
  const venueLayers: Layer[] = [];
  if (options.venue && input.venue && input.venue.length > 0) {
    const taken = new Set(LAYERS.map((l) => l.name));
    for (const layer of input.venue) {
      const base = `VENUE_${layer.name}`.replace(/[^A-Za-z0-9_$-]/g, '_').slice(0, 31);
      let name = base;
      for (let n = 2; taken.has(name.toUpperCase()); n++) name = `${base.slice(0, 31 - String(n).length - 1)}_${n}`;
      taken.add(name.toUpperCase());
      venueLayers.push({ name, colour: 8, linetype: 'CONTINUOUS' });
      for (const shade of layer.shades) {
        const colour = VENUE_ACI[shade.step] ?? 8;
        for (let i = 0; i + 3 < shade.edges.length; i += 4) {
          w.line(name, (shade.edges[i] as number) * 10, (shade.edges[i + 1] as number) * 10, (shade.edges[i + 2] as number) * 10, (shade.edges[i + 3] as number) * 10, colour);
        }
      }
    }
  }
  // Paper millimetres on the plot page to real millimetres, and back to the page's own y direction.
  const wx = (px: number) => ((px - plan.ox) / plan.mmPerM) * 1000;
  const wy = (py: number) => ((plan.oy - py) / plan.mmPerM) * 1000;
  const real = (paperMm: number) => paperMm * plan.ratio;
  const capHeight = (pt: number) => 0.72 * (pt / PT_PER_MM) * plan.ratio;
  const textAt = (layer: string, t: { x: number; y: number; size: number; text: string }) =>
    w.text(layer, wx(t.x), wy(t.y + 0.8 * (t.size / PT_PER_MM)), capHeight(t.size), t.text, (measure(t.text, t.size, false) / PT_PER_MM) * plan.ratio);

  // Array boxes, their Positions, then the pickups and the lines joining them.
  const dotR = real(dotRadiusMm(plan.ratio));
  for (const a of input.arrays) {
    const layer = a.kind === 'stacked' ? 'STACKS' : a.pickups.length === 0 ? 'ARRAYS_NO_PICKUP' : 'ARRAYS';
    a.corners.forEach((c, i) => {
      const n = a.corners[(i + 1) % a.corners.length] as { x: number; y: number };
      w.line(layer, mm(c.x), mm(c.y), mm(n.x), mm(n.y));
    });
    const [p0, p1, p2, p3] = a.corners;
    if (a.kind === 'stacked') {
      w.line('STACK_DIAGONALS', mm(p0.x), mm(p0.y), mm(p2.x), mm(p2.y));
      w.line('STACK_DIAGONALS', mm(p1.x), mm(p1.y), mm(p3.x), mm(p3.y));
      const cx = mm(a.position.x);
      const cy = mm(a.position.y);
      const sq = [[-dotR, -dotR], [dotR, -dotR], [dotR, dotR], [-dotR, dotR]] as const;
      sq.forEach(([x, y], i) => {
        const [nx, ny] = sq[(i + 1) % 4] as readonly [number, number];
        w.line('POSITIONS', cx + x, cy + y, cx + nx, cy + ny);
      });
    } else {
      w.circle('POSITIONS', mm(a.position.x), mm(a.position.y), dotR);
    }
  }
  const half = (MARKER_REAL_M * 1000) / 2;
  for (const p of input.points) {
    const x = mm(p.at.x);
    const y = mm(p.at.y);
    // The symbol the person chose, at full size: 250 mm across. One with typed text is on its own layer.
    const layer = p.custom ? 'PICKUPS_CUSTOM' : 'PICKUPS';
    for (const m of markerPrims(p.marker.shape, half * 2)) {
      if (m.kind === 'circle') w.circle(layer, x + m.cx, y + m.cy, m.r);
      else w.line(layer, x + m.x1, y + m.y1, x + m.x2, y + m.y2);
    }
  }
  const byArray = new Map<number, typeof input.points[number][]>();
  for (const p of input.points) byArray.set(p.arrayIndex, [...(byArray.get(p.arrayIndex) ?? []), p]);
  for (const list of byArray.values()) {
    const f = list.find((p) => p.which === 'front');
    const r = list.find((p) => p.which === 'rear');
    if (f && r) w.line('PICKUP_LINKS', mm(f.at.x), mm(f.at.y), mm(r.at.x), mm(r.at.y));
  }

  // The origin lines run the width and height of the plan frame; the two axes start at the origin.
  const fr = plan.frame;
  w.line('ORIGIN', wx(fr.x0), 0, wx(fr.x1), 0);
  w.line('ORIGIN', 0, wy(fr.y1), 0, wy(fr.y0));
  const arrow = (layer: string, dx: number, dy: number) => {
    const len = real(14);
    const head = real(2.2);
    const ex = dx * len;
    const ey = dy * len;
    w.line(layer, 0, 0, ex, ey);
    const a = Math.atan2(dy, dx);
    for (const s of [-1, 1]) w.line(layer, ex, ey, ex - head * Math.cos(a + s * 0.45), ey - head * Math.sin(a + s * 0.45));
  };
  arrow('AXIS_X', 1, 0);
  arrow('AXIS_Y', 0, 1);

  // Labels where the page put them, then their leaders.
  const layerOf = (t: PlotPlan['texts'][number]): string => {
    if (t.kind === 'axis') return t.text === '+X' ? 'AXIS_X' : 'AXIS_Y';
    return { pickup: 'LABELS', array: 'LABELS', origin: 'ORIGIN', side: 'SIDES' }[t.kind];
  };
  for (const t of plan.texts) textAt(layerOf(t), t);
  for (const [a, b] of plan.leaders) w.line('LEADERS', wx(a.x), wy(a.y), wx(b.x), wy(b.y));

  // Notes under the plan: the unit, the origin and the approved small print.
  const noteH = capHeight(5);
  const pitch = noteH * 1.6;
  const left = wx(fr.x0);
  let y = wy(fr.y1) - real(4);
  const origin = input.origin.trim();
  const notes: string[] = [
    input.subtitle.trim() ? `Rigging plot, ${input.subtitle.trim()}`.slice(0, 160) : 'Rigging plot',
    `${DXF_UNITS_NOTE} The origin 0,0 is the Soundvision origin${origin ? `, ${origin}` : ''}. +X is towards house left and +Y towards the audience.`,
    ...(input.notDrawn.length > 0 ? [`Not drawn, no position, size or azimuth in the report: ${input.notDrawn.join(', ')}`] : []),
    ...wrapChars(PLOT_SMALL_PRINT, 110),
  ];
  for (const n of notes.flatMap((t) => wrapChars(t, 110))) {
    w.text('NOTES', left, y, noteH, n, n.length * noteH * 0.8);
    y -= pitch;
  }

  const out = [...header({ minX: w.minX, minY: w.minY, maxX: w.maxX, maxY: w.maxY }, `Coordinates are the Soundvision report's metres times 1000.`, [...LAYERS, ...venueLayers])];
  // Not spread into push: a big venue has more entries than a call can take.
  const body = out.concat(['0', 'SECTION', '2', 'ENTITIES'], w.lines(), ['0', 'ENDSEC', '0', 'EOF']);
  // Lines are written in pairs: a group code, then its value.
  return `${body.join('\r\n')}\r\n`;
}
