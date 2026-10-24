import { describe, expect, it } from 'vitest';
import { layerOf, packEdges, parseVenue, underlayEdgeCount, unpackEdges, UNDERLAY_MAX_EDGES, UNDERLAY_MAX_LAYERS, visibleLayers } from './underlay';

/** SU4SV-style text built here, to the layout of the real exports but with invented content. */
function su4sv(blocks: [string, [number, number, number][]][], header: string[] = ['"; Exported by SU4SV v7.0"', '"; Invented Hall"', '";"', '"; LengthUnit","m"', '";"']): string {
  const out = [...header];
  for (const [label, pts] of blocks) {
    out.push(`"Label","${label}"`);
    for (const [x, y, z] of pts) out.push(`${x},${y},${z}`);
    out.push('";"');
  }
  return out.join('\n');
}

const SQUARE: [number, number, number][] = [
  [0, 0, 0],
  [4, 0, 0],
  [4, 3, 0],
  [0, 3, 0],
];

function ok(text: string) {
  const r = parseVenue(text);
  if (!r.ok) throw new Error(r.message);
  return r;
}

const all = (r: ReturnType<typeof ok>) => r.underlay.layers.flatMap((l) => l.shades.flatMap((s) => s.edges.map((_, i) => (i % 4 === 0 ? s.edges.slice(i, i + 4) : null)).filter((e): e is number[] => e !== null)));

describe('layerOf', () => {
  it('takes the number off the end of a label, whichever way it is written', () => {
    expect(layerOf('Wall 01')).toBe('Wall');
    expect(layerOf('Wall 001')).toBe('Wall');
    expect(layerOf('Wall_01')).toBe('Wall');
    expect(layerOf('Inner Wall 12')).toBe('Inner Wall');
    expect(layerOf('Layer0 001')).toBe('Layer0');
  });

  it('keeps a label with no number as its own layer, and a label that is only a number', () => {
    expect(layerOf('Stage')).toBe('Stage');
    expect(layerOf('Layer0')).toBe('Layer0');
    expect(layerOf('Wall001')).toBe('Wall001');
    expect(layerOf('01')).toBe('01');
  });
});

describe('reading an SU4SV text file', () => {
  it('turns a face into a closed outline of lines in whole centimetres and reports what it read', () => {
    const r = ok(su4sv([['Floor 01', SQUARE]]));
    expect(r.edges).toBe(4);
    expect(r.blocks).toBe(1);
    expect(r.badLines).toBe(0);
    expect(r.underlay.layers).toHaveLength(1);
    expect(r.underlay.layers[0]).toMatchObject({ name: 'Floor', hidden: false });
    expect(all(r)).toEqual(expect.arrayContaining([[0, 0, 400, 0], [400, 0, 400, 300], [400, 300, 0, 300], [0, 300, 0, 0]]));
  });

  it('turns two points into one line and ignores empty blocks and a single point', () => {
    const r = ok(su4sv([['Rail 01', [[0, 0, 1], [5, 0, 1]]], ['Empty 01', []], ['Dot 01', [[1, 1, 1]]]]));
    expect(r.edges).toBe(1);
    expect(r.blocks).toBe(1);
  });

  it('reads a file with a byte order mark and Windows line ends', () => {
    const r = ok(String.fromCharCode(0xfeff) + su4sv([['Floor 01', SQUARE]]).replace(/\n/g, String.fromCharCode(13, 10)));
    expect(r.edges).toBe(4);
  });

  it('counts the lines it cannot read and carries on', () => {
    const text = su4sv([['Floor 01', SQUARE]]).replace('4,3,0', 'four,three,zero').replace('0,3,0', '0,3');
    const r = ok(text);
    expect(r.badLines).toBe(2);
    // Two good points are left, which make one line.
    expect(r.edges).toBe(1);
  });

  it('counts vertex lines that come before any label', () => {
    const r = ok(`${su4sv([['Floor 01', SQUARE]], ['"; LengthUnit","m"', '1,2,3'])}`);
    expect(r.badLines).toBe(1);
  });

  it('refuses a file that is not in metres, or does not say', () => {
    const feet = parseVenue(su4sv([['Floor 01', SQUARE]], ['"; LengthUnit","ft"']));
    expect(feet.ok).toBe(false);
    if (!feet.ok) expect(feet.message).toMatch(/in ft.*metres/);
    const none = parseVenue(su4sv([['Floor 01', SQUARE]], ['"; Exported by SU4SV v7.0"']));
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.message).toMatch(/length unit/);
  });

  it('refuses a file with no lines in it', () => {
    const r = parseVenue(su4sv([['Empty 01', []]]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/No lines/);
  });

  it('groups labels into layers in the order they first appear', () => {
    const r = ok(su4sv([['Wall 01', SQUARE], ['Stage 01', SQUARE.map(([x, y, z]) => [x + 10, y, z] as [number, number, number])], ['Wall 02', SQUARE.map(([x, y, z]) => [x, y + 10, z] as [number, number, number])]]));
    expect(r.underlay.layers.map((l) => l.name)).toEqual(['Wall', 'Stage']);
    expect(underlayEdgeCount({ layers: [r.underlay.layers[0] as (typeof r.underlay.layers)[number]] })).toBe(8);
  });

  it('refuses a venue with too many layers', () => {
    const blocks = Array.from({ length: UNDERLAY_MAX_LAYERS + 1 }, (_, i) => [`Layer${i} 01`, [[i, 0, 0], [i, 1, 0]]] as [string, [number, number, number][]]);
    const r = parseVenue(su4sv(blocks));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/layers/);
  });

  it('refuses a venue with more lines than a plot can use, and says to simplify the model', () => {
    const blocks = Array.from({ length: UNDERLAY_MAX_EDGES + 1 }, (_, i) => ['Detail 01', [[i, 0, 0], [i, 1, 0]]] as [string, [number, number, number][]]);
    const r = parseVenue(su4sv(blocks));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Simplify the model in SketchUp/);
  });

  it('accepts a venue right at the limit', () => {
    const blocks = Array.from({ length: UNDERLAY_MAX_EDGES }, (_, i) => ['Detail 01', [[i, 0, 0], [i, 1, 0]]] as [string, [number, number, number][]]);
    expect(parseVenue(su4sv(blocks)).ok).toBe(true);
  });
});

describe('turning a 3D venue into a plan', () => {
  it('drops the height and the lines that stand upright, and keeps a wall as one line', () => {
    // A wall: bottom edge at the floor, top edge 6 m up, and two upright edges that have no length on the plan.
    const wall: [number, number, number][] = [[0, 0, 0], [8, 0, 0], [8, 0, 6], [0, 0, 6]];
    const r = ok(su4sv([['Wall 01', wall]]));
    expect(r.edges).toBe(1);
    expect(all(r)).toEqual([[0, 0, 800, 0]]);
  });

  it('keeps a line drawn twice, or drawn the other way round, once', () => {
    const r = ok(su4sv([['Wall 01', [[0, 0, 0], [5, 0, 0]]], ['Wall 02', [[5, 0, 0], [0, 0, 0]]], ['Wall 03', [[0, 0, 0], [5, 0, 0]]]]));
    expect(r.edges).toBe(1);
  });

  it('keeps a line that two layers share in each layer, so either layer can be switched off', () => {
    const r = ok(su4sv([['A 01', [[0, 0, 0], [5, 0, 0]]], ['B 01', [[0, 0, 0], [5, 0, 0]]]]));
    expect(r.underlay.layers.map((l) => underlayEdgeCount({ layers: [l] }))).toEqual([1, 1]);
  });

  it('drops a line shorter than a centimetre', () => {
    const r = ok(su4sv([['Floor 01', SQUARE], ['Speck 01', [[10, 10, 0], [10.003, 10.002, 0]]]]));
    expect(r.edges).toBe(4);
  });

  it('shades the lowest part darkest and the highest lightest', () => {
    const r = ok(
      su4sv([
        ['Floor 01', [[0, 0, 0], [4, 0, 0]]],
        ['Low 01', [[0, 1, 1], [4, 1, 1]]],
        ['High 01', [[0, 2, 2], [4, 2, 2]]],
        ['Roof 01', [[0, 3, 3], [4, 3, 3]]],
      ]),
    );
    const stepOf = (name: string) => r.underlay.layers.find((l) => l.name === name)?.shades[0]?.step;
    expect(stepOf('Floor')).toBe(0);
    expect(stepOf('Roof')).toBe(3);
    expect(stepOf('Low') as number).toBeLessThan(stepOf('High') as number);
    expect(stepOf('Low') as number).toBeGreaterThanOrEqual(0);
  });

  it('does not let a few very tall things flatten the steps', () => {
    const blocks: [string, [number, number, number][]][] = [];
    // A hundred lines between 0 and 4 m high, and one tree 300 m up.
    for (let i = 0; i < 100; i++) blocks.push([`Ground ${i + 1}`, [[i, 0, i / 25], [i, 1, i / 25]]]);
    blocks.push(['Tree 01', [[500, 0, 300], [500, 1, 300]]]);
    const r = ok(su4sv(blocks));
    const steps = new Set(r.underlay.layers.find((l) => l.name === 'Ground')?.shades.map((s) => s.step));
    expect(steps.size).toBeGreaterThanOrEqual(3);
  });

  it('puts everything in the darkest shade when nothing has any height', () => {
    const r = ok(su4sv([['Floor 01', SQUARE]]));
    expect(r.underlay.layers[0]?.shades.map((s) => s.step)).toEqual([0]);
  });
});

describe('packing lines for the saved file', () => {
  it('gives the same lines back, for lines that follow one another and lines that do not, in either direction', () => {
    const edges = [0, 0, 400, 0, 400, 0, 400, 300, 900, -250, 1000, -300, -5, -7, -2000, 1234567];
    const packed = packEdges(edges);
    expect(unpackEdges(packed)).toEqual(edges);
    expect(packed).not.toContain('\n');
  });

  it('is short for lines that follow one another', () => {
    const chain: number[] = [];
    for (let i = 0; i < 1000; i++) chain.push(i * 10, 0, (i + 1) * 10, 0);
    expect(packEdges(chain).length).toBeLessThan(1000 * 6);
  });

  it('packs nothing as an empty string', () => {
    expect(packEdges([])).toBe('');
    expect(unpackEdges('')).toEqual([]);
  });

  it('refuses text that this app did not write', () => {
    for (const bad of ['x', '1', '1,2,3', 'a,b,c d,e', '1,2 3', '1,,2', '<script>,1', 'zzzzzzzzzzz,1', '1,2,3,4,5']) expect(unpackEdges(bad)).toBeNull();
  });

  it('refuses a line a long way outside the plan', () => {
    expect(unpackEdges(packEdges([0, 0, 1, 1]).replace('1,1', 'zzzzzz,1'))).toBeNull();
  });
});

describe('visible layers', () => {
  it('leaves out layers that are switched off, and nothing at all for no venue', () => {
    const r = ok(su4sv([['A 01', SQUARE], ['B 01', SQUARE]]));
    const u = { layers: r.underlay.layers.map((l) => (l.name === 'B' ? { ...l, hidden: true } : l)) };
    expect(visibleLayers(u).map((l) => l.name)).toEqual(['A']);
    expect(visibleLayers(null)).toEqual([]);
    expect(visibleLayers(undefined)).toEqual([]);
  });
});
