import { describe, expect, it } from 'vitest';
import { defaultSymbolValues } from '../engine/markers';
import { suggestedDxfName } from '../files/file-name';
import { parseFixture } from '../testing/fixtures';
import { newDoc, withOnPlot } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { estimateWidth } from './array-image';
import { DXF_UNITS_NOTE, dxfText, plotDxf, wrapChars } from './plot-dxf';
import { plotContent } from './plot-input';
import { PLOT_SMALL_PRINT } from './small-print';

type Pair = [number, string];
interface Entity {
  type: string;
  layer: string;
  g: Map<number, string>;
}

const built = new Map<string, ReturnType<typeof buildUncached>>();
/** The plot of a fixture, made once: laying out the labels is the slow part. */
function build(name: 'a' | 'c' | 'e') {
  let b = built.get(name);
  if (!b) built.set(name, (b = buildUncached(name)));
  return b;
}

function buildUncached(name: 'a' | 'c' | 'e', tweak: (d: ReturnType<typeof newDoc>) => void = () => undefined) {
  const doc = newDoc(parseFixture(name), `${name}.pdf`);
  doc.job.origin = 'DSE';
  tweak(doc);
  const content = plotContent(doc, sheetModel(doc, false))!;
  const text = plotDxf({ ...content, footer: () => '' }, estimateWidth)!;
  return { content, text };
}

/** A strict structural read of the file: group code and value pairs, sections in order, a closing end of file. */
function read(text: string) {
  expect(text.endsWith('\r\n')).toBe(true);
  const lines = text.split('\r\n');
  lines.pop();
  expect(lines.length % 2).toBe(0);
  const pairs: Pair[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i]);
    expect(Number.isInteger(code), `group code "${lines[i]}" at line ${i + 1}`).toBe(true);
    pairs.push([code, lines[i + 1] as string]);
  }
  expect(pairs[pairs.length - 1]).toEqual([0, 'EOF']);
  const sections = new Map<string, Pair[]>();
  let current: Pair[] | null = null;
  for (let i = 0; i < pairs.length; i++) {
    const [code, value] = pairs[i] as Pair;
    if (code === 0 && value === 'SECTION') {
      const name = (pairs[i + 1] as Pair)[1];
      current = [];
      sections.set(name, current);
      i++;
    } else if (code === 0 && value === 'ENDSEC') {
      current = null;
    } else if (current) {
      current.push([code, value]);
    }
  }
  expect(current).toBeNull();
  const entities: Entity[] = [];
  for (const [code, value] of sections.get('ENTITIES') ?? []) {
    if (code === 0) entities.push({ type: value, layer: '', g: new Map() });
    else {
      const e = entities[entities.length - 1] as Entity;
      if (code === 8) e.layer = value;
      e.g.set(code, value);
    }
  }
  const header = new Map<string, Pair[]>();
  let key = '';
  for (const [code, value] of sections.get('HEADER') ?? []) {
    if (code === 9) {
      key = value;
      header.set(key, []);
    } else header.get(key)?.push([code, value]);
  }
  const layers: string[] = [];
  const tables = sections.get('TABLES') ?? [];
  tables.forEach(([code, value], i) => {
    if (code === 0 && value === 'LAYER') layers.push((tables[i + 1] as Pair)[1]);
  });
  return { pairs, sections, entities, header, layers };
}

const n = (e: Entity, code: number) => Number(e.g.get(code));

describe('plot DXF', () => {
  it('is a well formed file in millimetres at full size', () => {
    for (const name of ['a', 'c', 'e'] as const) {
      const { text } = build(name);
      const f = read(text);
      expect([...f.sections.keys()]).toEqual(['HEADER', 'TABLES', 'ENTITIES']);
      expect(f.header.get('$ACADVER')).toEqual([[1, 'AC1009']]);
      expect(f.header.get('$INSUNITS')).toEqual([[70, '4']]);
      expect(f.header.get('$MEASUREMENT')).toEqual([[70, '1']]);
      expect(text.split('\r\n').slice(0, 4).join(' ')).toContain('999');
      expect(text).toContain(DXF_UNITS_NOTE);
      // Every number is finite and nothing says undefined or NaN.
      expect(text).not.toMatch(/NaN|undefined|Infinity/);
      // Every entity is on a layer the file defines, and carries its coordinates.
      for (const e of f.entities) {
        expect(f.layers).toContain(e.layer);
        expect(['LINE', 'CIRCLE', 'TEXT']).toContain(e.type);
        for (const code of [10, 20, 30]) expect(Number.isFinite(n(e, code))).toBe(true);
      }
      expect(f.layers).toEqual(expect.arrayContaining(['ARRAYS', 'PICKUPS', 'LABELS', 'ORIGIN', 'NOTES']));
    }
  });

  it('puts an array box where the report puts it, in millimetres, with X as the report states it', () => {
    const { content, text } = build('c');
    const f = read(text);
    const flown = content.arrays.find((a) => a.kind === 'flown' && a.pickups.length > 0)!;
    const boxLines = f.entities.filter((e) => e.type === 'LINE' && e.layer === 'ARRAYS');
    for (const [i, c] of flown.corners.entries()) {
      const next = flown.corners[(i + 1) % 4]!;
      const hit = boxLines.some(
        (e) =>
          Math.abs(n(e, 10) - c.x * 1000) < 0.01 && Math.abs(n(e, 20) - c.y * 1000) < 0.01 && Math.abs(n(e, 11) - next.x * 1000) < 0.01 && Math.abs(n(e, 21) - next.y * 1000) < 0.01,
      );
      expect(hit, `edge ${i} of ${flown.name}`).toBe(true);
    }
    // The Position is a circle at the report's X and Y.
    const dot = f.entities.find(
      (e) => e.type === 'CIRCLE' && e.layer === 'POSITIONS' && Math.abs(n(e, 10) - flown.position.x * 1000) < 0.01 && Math.abs(n(e, 20) - flown.position.y * 1000) < 0.01,
    );
    expect(dot).toBeDefined();
  });

  it('draws a 250 mm pickup marker at each pickup, at full size, all on the pickups layer', () => {
    for (const name of ['a', 'c', 'e'] as const) {
      const { content, text } = build(name);
      const f = read(text);
      const onLayer = (type: string) => f.entities.filter((e) => e.type === type && e.layer === 'PICKUPS');
      const circles = onLayer('CIRCLE');
      expect(circles).toHaveLength(content.points.length);
      for (const p of content.points) {
        const c = circles.find((e) => Math.abs(n(e, 10) - p.at.x * 1000) < 0.01 && Math.abs(n(e, 20) - p.at.y * 1000) < 0.01);
        expect(c, p.label).toBeDefined();
        expect(n(c as Entity, 40)).toBe(125);
      }
      // A cross: two lines for every circle.
      expect(onLayer('LINE')).toHaveLength(content.points.length * 2);
    }
  });

  it('draws each shape at full size: a square, a triangle or a diamond in place of the circle', () => {
    const shapes = ['two', 'half', 'quarter'] as const;
    const input = build('c').content;
    const points = input.points.map((p, i) => ({ ...p, marker: { shape: shapes[i % 3] as (typeof shapes)[number] } }));
    const f = read(plotDxf({ ...input, points, footer: () => '' } as never, estimateWidth) as string);
    const pickupLines = f.entities.filter((e) => e.type === 'LINE' && e.layer === 'PICKUPS');
    expect(f.entities.filter((e) => e.type === 'CIRCLE' && e.layer === 'PICKUPS')).toHaveLength(0);
    // Square: 4 sides and a cross (6 lines); triangle: 3 sides and a cross (5); diamond: 4 sides and a cross (6).
    const expected = points.reduce((sum, p) => sum + (p.marker.shape === 'half' ? 5 : 6), 0);
    expect(pickupLines).toHaveLength(expected);
    // The first pickup is a square 250 mm across, centred on it.
    const first = points[0]!;
    const near = (e: Entity) => [10, 11].every((c) => Math.abs(n(e, c) - first.at.x * 1000) <= 125.01) && [20, 21].every((c) => Math.abs(n(e, c) - first.at.y * 1000) <= 125.01);
    const xs = pickupLines.filter(near).flatMap((e) => [n(e, 10), n(e, 11)]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(250, 1);
  });

  it('has no layer for custom symbols, and names the value written for each symbol in the notes', () => {
    const input = build('c').content;
    const usual = plotDxf({ ...input, footer: () => '' }, estimateWidth) as string;
    expect(usual).not.toContain('PICKUPS_CUSTOM');
    expect(usual).toContain('Pickup symbols, a guide only: square 2 t, circle 1 t, triangle 0.5 t, diamond 0.25 t.');
    const set = plotDxf({ ...input, symbolValues: { two: '2 t', one: '1.5 t', half: '0.4 t', quarter: '0.25 t' }, footer: () => '' }, estimateWidth) as string;
    expect(set).toContain('circle 1.5 t, triangle 0.4 t');
  });

  it('labels each pickup and array with the same words as the plot page', () => {
    const { content, text } = build('c');
    const words = read(text)
      .entities.filter((e) => e.type === 'TEXT')
      .map((e) => e.g.get(1) as string);
    for (const p of content.points) expect(words.some((w) => w.startsWith(`${p.label}  `))).toBe(true);
    for (const a of content.arrays) expect(words).toContain(dxfText(a.name));
    expect(words).toContain('Soundvision origin: DSE');
    expect(words).toEqual(expect.arrayContaining(['House left', 'House right', 'Stage', 'Audience']));
    expect(words.some((w) => /^Total [\d.]+ kg$/.test(w))).toBe(true);
    expect(words.some((w) => /^Spacing [\d.]+ m$/.test(w))).toBe(true);
  });

  it('leaves the side labels off when they are ticked off', () => {
    const { text } = buildUncached('e', (d) => {
      d.job.sideLabels = false;
    });
    const words = read(text)
      .entities.filter((e) => e.type === 'TEXT')
      .map((e) => e.g.get(1));
    for (const w of ['House left', 'House right', 'Stage', 'Audience']) expect(words).not.toContain(w);
  });

  it('carries the approved small print word for word and the unit in the file', () => {
    const { text } = build('a');
    const noteLines = read(text)
      .entities.filter((e) => e.type === 'TEXT' && e.layer === 'NOTES')
      .map((e) => e.g.get(1) as string);
    expect(noteLines.join(' ')).toContain(PLOT_SMALL_PRINT);
    expect(noteLines.join(' ')).toContain('millimetres at full size (1:1)');
    expect(noteLines.join(' ')).toContain('Soundvision origin, DSE');
  });

  it('draws stacks with their own layers and the same Position circle as any array', () => {
    const { content, text } = build('a');
    const f = read(text);
    const stacks = content.arrays.filter((a) => a.kind === 'stacked');
    expect(stacks.length).toBeGreaterThan(0);
    expect(f.entities.filter((e) => e.layer === 'STACK_DIAGONALS')).toHaveLength(stacks.length * 2);
    // Four edges for each stack, and a Position circle on the same layer as every other array, with no square.
    expect(f.entities.filter((e) => e.layer === 'STACKS')).toHaveLength(stacks.length * 4);
    expect(f.entities.filter((e) => e.type === 'LINE' && e.layer === 'POSITIONS')).toHaveLength(0);
    expect(f.entities.filter((e) => e.type === 'CIRCLE' && e.layer === 'POSITIONS')).toHaveLength(content.arrays.length);
  });

  it('leaves out the Position circles when Show position is off and the array lines when Show outlines is off, and keeps the pickups and the layer table', () => {
    const on = read(build('a').text);
    const noPos = read(buildUncached('a', (d) => (d.plotShow = { position: false, outlines: true })).text);
    const noBox = read(buildUncached('a', (d) => (d.plotShow = { position: true, outlines: false })).text);
    const count = (f: ReturnType<typeof read>, layers: string[]) => f.entities.filter((e) => layers.includes(e.layer)).length;
    const boxLayers = ['ARRAYS', 'ARRAYS_NO_PICKUP', 'STACKS', 'STACK_DIAGONALS'];
    expect(count(on, ['POSITIONS'])).toBeGreaterThan(0);
    expect(count(noPos, ['POSITIONS'])).toBe(0);
    expect(count(noPos, boxLayers)).toBe(count(on, boxLayers));
    expect(count(noBox, boxLayers)).toBe(0);
    expect(count(noBox, ['POSITIONS'])).toBe(count(on, ['POSITIONS']));
    for (const f of [noPos, noBox]) {
      expect(f.layers).toEqual(on.layers);
      expect(count(f, ['PICKUPS'])).toBe(count(on, ['PICKUPS']));
    }
  });

  it('writes plain ASCII with other characters escaped', () => {
    expect(dxfText('Kara ° café')).toBe('Kara \\U+00B0 caf\\U+00E9');
    for (const name of ['a', 'c', 'e'] as const) expect(Array.from(build(name).text).every((ch) => (ch.codePointAt(0) as number) < 128)).toBe(true);
  });

  it('is named like the PDF, with a revision when there is one', () => {
    expect(suggestedDxfName('Main stage.xmlp', '')).toBe('Main stage.dxf');
    expect(suggestedDxfName('Main stage', 'B')).toBe('Main stage - Rev B.dxf');
  });

  it('wraps notes at spaces', () => {
    const lines = wrapChars(PLOT_SMALL_PRINT, 110);
    expect(lines.every((l) => l.length <= 110)).toBe(true);
    expect(lines.join(' ')).toBe(PLOT_SMALL_PRINT);
  });

  it('makes no network request', () => {
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      return Promise.reject(new Error('no network'));
    }) as typeof fetch;
    try {
      build('a');
    } finally {
      globalThis.fetch = original;
    }
    expect(called).toBe(false);
  });

  it('leaves out an array that is not on the plot, and its pickup', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    const index = doc.result.report.sources.findIndex((s) => s.name === 'KARA II L Out');
    const model = (d: typeof doc) => plotContent(d, sheetModel(d, true))!;
    const whole = plotDxf({ ...model(doc), footer: () => '' }, estimateWidth)!;
    const less = plotDxf({ ...model(withOnPlot(doc, index, false)), footer: () => '' }, estimateWidth)!;
    expect(whole).toContain('KARA II L Out');
    expect(less).not.toContain('KARA II L Out');
    expect(less.length).toBeLessThan(whole.length);
  });

  it('is null when nothing can be drawn', () => {
    expect(plotDxf({ arrays: [], points: [], notDrawn: [], origin: '', sideLabels: true, symbolValues: defaultSymbolValues(), subtitle: '', status: '', footer: () => '' }, estimateWidth)).toBeNull();
  });
});
