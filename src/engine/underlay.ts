// A venue drawn as a grey underlay on the rigging plot. It is read from the text file SU4SV writes (the SketchUp to
// Soundvision converter): blocks of x, y, z points in metres, one block for each face or outline, under a label that
// names the SketchUp layer. Only the plan is kept: the height is dropped, and used only to pick a shade of grey.
// The 3D text is never stored. What is kept is lines in whole centimetres, grouped by layer and shade.

export const UNDERLAY_STEPS = 4;
/** More lines than this, once duplicates are removed, is too much detail for a plot: the model should be simplified. */
export const UNDERLAY_MAX_EDGES = 60000;
export const UNDERLAY_MAX_LAYERS = 300;
export const UNDERLAY_NAME_MAX = 80;
/** The longest import file the app reads, in bytes of text. */
export const VENUE_MAX_BYTES = 8 * 1024 * 1024;
/** Coordinates are kept in whole centimetres and must stay within 100 km of the origin. */
const LIMIT_CM = 10_000_000;

export interface UnderlayShade {
  /** 0 is the lowest part of the venue and the darkest grey. */
  step: number;
  /** Lines as x1, y1, x2, y2 in whole centimetres, one after another. */
  edges: number[];
}

export interface UnderlayLayer {
  name: string;
  /** The person turned this layer off. */
  hidden: boolean;
  shades: UnderlayShade[];
}

export interface Underlay {
  layers: UnderlayLayer[];
}

export type VenueResult =
  | { ok: true; underlay: Underlay; edges: number; badLines: number; blocks: number }
  | { ok: false; message: string };

/** The SketchUp layer a label belongs to: the label without its trailing number, e.g. "Wall 01" and "Wall_002" are both "Wall". */
export function layerOf(label: string): string {
  const name = label.replace(/[\s_]+\d+$/, '').trim();
  return (name === '' ? label.trim() : name).slice(0, UNDERLAY_NAME_MAX) || 'Unnamed';
}

const NUMBER = '(-?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)';
const VERTEX = new RegExp(`^\\s*${NUMBER}\\s*,\\s*${NUMBER}\\s*,\\s*${NUMBER}\\s*$`);

/** Number of lines (edges) in an underlay, hidden layers included. */
export function underlayEdgeCount(u: Underlay): number {
  return u.layers.reduce((n, l) => n + l.shades.reduce((m, s) => m + s.edges.length / 4, 0), 0);
}

/** The layers that are on, or null when none is, so a plot that has nothing to draw skips the work. */
export function visibleLayers(u: Underlay | null | undefined): UnderlayLayer[] {
  return u ? u.layers.filter((l) => !l.hidden && l.shades.length > 0) : [];
}

const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
const percentile = (s: number[], p: number) => s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] as number;

/**
 * Read an SU4SV text export. The file must be in metres. Each block becomes lines: two points make one line, three or
 * more make a closed outline. Identical lines (also when drawn the other way round) are kept once, at the lowest height
 * they have, so a wall seen from above is one line at the floor. Lines shorter than a centimetre are dropped.
 */
export function parseVenue(input: string): VenueResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const lines = text.split(/\r?\n/);
  let unit: string | null = null;
  let badLines = 0;
  let blocks = 0;
  const order: string[] = [];
  const perLayer = new Map<string, Map<string, number>>();
  const endpoints = new Map<string, [number, number, number, number]>();
  let layer: string | null = null;
  let pts: [number, number, number][] = [];

  const addEdge = (a: [number, number, number], b: [number, number, number]) => {
    const x1 = Math.round(a[0] * 100);
    const y1 = Math.round(a[1] * 100);
    const x2 = Math.round(b[0] * 100);
    const y2 = Math.round(b[1] * 100);
    if (x1 === x2 && y1 === y2) return;
    const flip = x1 > x2 || (x1 === x2 && y1 > y2);
    const key = flip ? `${x2},${y2},${x1},${y1}` : `${x1},${y1},${x2},${y2}`;
    const z = (a[2] + b[2]) / 2;
    let edges = perLayer.get(layer as string);
    if (!edges) {
      edges = new Map();
      perLayer.set(layer as string, edges);
      order.push(layer as string);
    }
    const seen = edges.get(key);
    if (seen === undefined) {
      edges.set(key, z);
      // Drawn in the order the file gives them, so lines that follow one another stay together and pack small.
      endpoints.set(`${layer}|${key}`, [x1, y1, x2, y2]);
    } else if (z < seen) {
      edges.set(key, z);
    }
  };

  const finish = () => {
    if (layer === null) return;
    if (pts.length >= 2) blocks++;
    if (pts.length === 2) addEdge(pts[0] as [number, number, number], pts[1] as [number, number, number]);
    else if (pts.length >= 3) {
      for (let i = 0; i < pts.length - 1; i++) addEdge(pts[i] as [number, number, number], pts[i + 1] as [number, number, number]);
      addEdge(pts[pts.length - 1] as [number, number, number], pts[0] as [number, number, number]);
    }
    pts = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('"Label"')) {
      finish();
      const m = /^"Label"\s*,\s*"(.*)"$/.exec(line);
      if (!m) {
        badLines++;
        layer = null;
        continue;
      }
      layer = layerOf(m[1] as string);
      continue;
    }
    if (line.startsWith('";') || line.startsWith('"; ')) {
      const u = /^"; LengthUnit"\s*,\s*"([^"]*)"/.exec(line);
      if (u) unit = (u[1] as string).trim();
      continue;
    }
    const v = VERTEX.exec(line);
    if (v && layer !== null) {
      const p: [number, number, number] = [Number(v[1]), Number(v[2]), Number(v[3])];
      if (Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]) && Math.abs(p[0]) * 100 < LIMIT_CM && Math.abs(p[1]) * 100 < LIMIT_CM) pts.push(p);
      else badLines++;
      continue;
    }
    badLines++;
  }
  finish();

  if (unit === null) return { ok: false, message: 'This file does not say what its length unit is, so it does not look like an SU4SV export. Export it again from SketchUp with SU4SV, in metres.' };
  if (unit.toLowerCase() !== 'm') return { ok: false, message: `This venue file is in ${unit || 'an unknown unit'}. Export it again from SketchUp with SU4SV, in metres.` };
  if (order.length > UNDERLAY_MAX_LAYERS) return { ok: false, message: `This venue has ${order.length} layers, and the most that can be kept is ${UNDERLAY_MAX_LAYERS}. Simplify the model in SketchUp and export it again.` };
  const total = order.reduce((n, name) => n + (perLayer.get(name)?.size ?? 0), 0);
  if (total === 0) return { ok: false, message: 'No lines could be read from this file. It should be a text file written by SU4SV, in metres.' };
  if (total > UNDERLAY_MAX_EDGES) {
    return {
      ok: false,
      message: `This venue has ${total.toLocaleString('en-GB')} lines once duplicates are removed, and the most that can be kept is ${UNDERLAY_MAX_EDGES.toLocaleString('en-GB')}. Simplify the model in SketchUp, for example by hiding or deleting detail the plot does not need, and export it again.`,
    };
  }

  // Heights pick the shade. The range ignores the extreme 2 percent at each end, so a few very tall things do not flatten the steps.
  const zs: number[] = [];
  for (const edges of perLayer.values()) for (const z of edges.values()) zs.push(z);
  const s = sorted(zs);
  const lo = percentile(s, 0.02);
  const hi = percentile(s, 0.98);
  const stepOf = (z: number) => (hi - lo < 1e-9 ? 0 : Math.min(UNDERLAY_STEPS - 1, Math.max(0, Math.floor(((z - lo) / (hi - lo)) * UNDERLAY_STEPS))));

  const layers: UnderlayLayer[] = order.map((name) => {
    const byStep: number[][] = Array.from({ length: UNDERLAY_STEPS }, () => []);
    for (const [key, z] of perLayer.get(name) as Map<string, number>) {
      const [x1, y1, x2, y2] = endpoints.get(`${name}|${key}`) as [number, number, number, number];
      (byStep[stepOf(z)] as number[]).push(x1, y1, x2, y2);
    }
    return { name, hidden: false, shades: byStep.flatMap((edges, step) => (edges.length > 0 ? [{ step, edges }] : [])) };
  });
  return { ok: true, underlay: { layers }, edges: total, badLines, blocks };
}

// ---- Packing, for the saved file ----
// Lines are written as text, because a list of numbers would take a line each in the saved file. A line that starts where the
// last one ended is "dx,dy" (its vector); any other is "jumpX,jumpY,dx,dy" with the jump measured from where the last one ended.
// Numbers are base 36, so a typical line takes about ten characters.

const b36 = (n: number) => n.toString(36);
const TOKEN = /^-?[0-9a-z]{1,8}$/;

export function packEdges(edges: readonly number[]): string {
  const out: string[] = [];
  let ex = 0;
  let ey = 0;
  for (let i = 0; i + 3 < edges.length; i += 4) {
    const x1 = edges[i] as number;
    const y1 = edges[i + 1] as number;
    const x2 = edges[i + 2] as number;
    const y2 = edges[i + 3] as number;
    out.push(x1 === ex && y1 === ey ? `${b36(x2 - x1)},${b36(y2 - y1)}` : `${b36(x1 - ex)},${b36(y1 - ey)},${b36(x2 - x1)},${b36(y2 - y1)}`);
    ex = x2;
    ey = y2;
  }
  return out.join(' ');
}

/** The lines in a packed string, or null when it is not one this app wrote. */
export function unpackEdges(packed: string): number[] | null {
  if (packed === '') return [];
  const out: number[] = [];
  let ex = 0;
  let ey = 0;
  for (const token of packed.split(' ')) {
    const parts = token.split(',');
    if ((parts.length !== 2 && parts.length !== 4) || !parts.every((p) => TOKEN.test(p))) return null;
    const n = parts.map((p) => parseInt(p, 36));
    const [x1, y1, dx, dy] = parts.length === 2 ? [ex, ey, n[0] as number, n[1] as number] : [ex + (n[0] as number), ey + (n[1] as number), n[2] as number, n[3] as number];
    const x2 = x1 + dx;
    const y2 = y1 + dy;
    if ([x1, y1, x2, y2].some((v) => !Number.isFinite(v) || Math.abs(v) > LIMIT_CM)) return null;
    out.push(x1, y1, x2, y2);
    ex = x2;
    ey = y2;
  }
  return out;
}
