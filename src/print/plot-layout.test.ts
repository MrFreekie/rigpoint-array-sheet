import { describe, expect, it } from 'vitest';
import { numberPickups, plotArrays } from '../engine/plot';
import { parseFixture } from '../testing/fixtures';
import { newDoc } from '../ui/document';
import { sheetModel } from '../ui/sheet-model';
import { NOT_STATED } from '../ui/format';
import { estimateWidth } from './array-image';
import { CREDIT_TEXT } from './footer';
import { PT_PER_MM } from './pdf-layout';
import { plotContent } from './plot-input';
import {
  CHECK_BAR_MM,
  CHECK_BAR_TEXT,
  chooseRatio,
  dotRadiusMm,
  layoutPlotPages,
  markerSizeMm,
  PLOT_H_MM,
  PLOT_TABLE_ROWS,
  PLOT_W_MM,
  plotPageCount,
  PRINT_PALETTE,
  scaleBarMetres,
  tableRow,
  tableNameLines,
  SCREEN_PALETTE,
  type PlotInput,
  type PlotOp,
} from './plot-layout';

function pages(name: 'a' | 'c' | 'e', tweak: (d: ReturnType<typeof newDoc>) => void = () => undefined) {
  const doc = newDoc(parseFixture(name), `${name}.pdf`);
  doc.job.origin = 'DSE';
  tweak(doc);
  const content = plotContent(doc, sheetModel(doc, false))!;
  return { content, pages: layoutPlotPages({ ...content, footer: (i) => `footer ${i}` }, estimateWidth) };
}

const texts = (ops: PlotOp[]) => ops.flatMap((o) => (o.op === 'text' ? [o.text] : []));

type TextOp = Extract<PlotOp, { op: 'text' }>;

/** The box a text step covers, with its real width. */
function textBox(o: TextOp) {
  const w = estimateWidth(o.text, o.size, o.bold) / PT_PER_MM;
  const x0 = o.align === 'left' ? o.x : o.align === 'right' ? o.x - w : o.x - w / 2;
  return { x0, x1: x0 + w, y0: o.y, y1: o.y + o.size / PT_PER_MM };
}

const crosses = (a: ReturnType<typeof textBox>, b: ReturnType<typeof textBox>) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 - 0.05 && b.y0 < a.y1 - 0.05;

/** Whether a drawn line passes through a rectangle (sampled finely; the lines are a few millimetres to a few centimetres long). */
function rectHitsSegment(r: { x0: number; y0: number; x1: number; y1: number }, l: { x1: number; y1: number; x2: number; y2: number }): boolean {
  const steps = Math.max(2, Math.ceil(Math.hypot(l.x2 - l.x1, l.y2 - l.y1) / 0.1));
  for (let i = 0; i <= steps; i++) {
    const x = l.x1 + ((l.x2 - l.x1) * i) / steps;
    const y = l.y1 + ((l.y2 - l.y1) * i) / steps;
    if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return true;
  }
  return false;
}

describe('scale', () => {
  it('takes the largest standard ratio that fits', () => {
    expect(chooseRatio(100, 100, 100, 100)).toEqual({ ratio: 1000, fits: true });
    expect(chooseRatio(100, 100, 200, 200)).toEqual({ ratio: 500, fits: true });
    expect(chooseRatio(100, 100, 100.1, 100)).toEqual({ ratio: 1000, fits: true });
    expect(chooseRatio(100, 100, 99.9, 99.9)).toEqual({ ratio: 1500, fits: true });
  });

  it('says so when even the smallest scale is too big', () => {
    expect(chooseRatio(100000, 10, 100, 100).fits).toBe(false);
  });

  it('makes a pickup marker 250 mm across, never less than 2 mm', () => {
    expect(markerSizeMm(50)).toBe(5);
    expect(markerSizeMm(100)).toBe(2.5);
    expect(markerSizeMm(125)).toBe(2);
    expect(markerSizeMm(400)).toBe(2);
  });

  it('draws a scale bar of a round length no longer than the room', () => {
    expect(scaleBarMetres(1000 / 150, 60)).toBe(5);
    expect(scaleBarMetres(1000 / 400, 60)).toBe(20);
  });
});

describe('the plot page', () => {
  it('keeps every step inside the printable area, on reports A, C and E', () => {
    for (const n of ['a', 'c', 'e'] as const) {
      for (const p of pages(n).pages) {
        expect(p.overflow, n).toBe(false);
        for (const o of p.ops) {
          const box = o.op === 'text' ? textBox(o) : null;
          const xs = o.op === 'text' ? [box!.x0, box!.x1] : o.op === 'line' ? [o.x1, o.x2] : o.op === 'segs' ? o.pts.filter((_, k) => k % 2 === 0) : [o.cx - o.r, o.cx + o.r];
          const ys = o.op === 'text' ? [box!.y0, box!.y1] : o.op === 'line' ? [o.y1, o.y2] : o.op === 'segs' ? o.pts.filter((_, k) => k % 2 === 1) : [o.cy - o.r, o.cy + o.r];
          for (const x of xs) {
            expect(x, `${n} ${JSON.stringify(o)}`).toBeGreaterThanOrEqual(-0.01);
            expect(x, `${n} ${JSON.stringify(o)}`).toBeLessThanOrEqual(PLOT_W_MM + 0.01);
          }
          for (const y of ys) {
            expect(y, `${n} ${JSON.stringify(o)}`).toBeGreaterThanOrEqual(-0.01);
            expect(y, `${n} ${JSON.stringify(o)}`).toBeLessThanOrEqual(PLOT_H_MM + 0.01);
          }
        }
      }
    }
  });

  it('draws the 100 mm check bar exactly, with its wording', () => {
    const page = pages('c').pages[0]!;
    const lengths = page.ops.flatMap((o) => (o.op === 'line' && o.width === 0.6 && o.y1 === o.y2 ? [o.x2 - o.x1] : []));
    expect(lengths).toContain(CHECK_BAR_MM);
    expect(texts(page.ops)).toContain(CHECK_BAR_TEXT);
  });

  it('draws the scale bar to the scale of the page', () => {
    const page = pages('e').pages[0]!;
    const bars = page.ops.flatMap((o) => (o.op === 'line' && o.width === 0.6 && o.y1 === o.y2 && o.x2 - o.x1 !== CHECK_BAR_MM ? [o.x2 - o.x1] : []));
    const metres = Number(texts(page.ops).find((t) => /^\d+ m$/.test(t))?.replace(' m', ''));
    expect(bars).toHaveLength(1);
    expect(bars[0]).toBeCloseTo((metres * 1000) / page.ratio, 6);
    expect(texts(page.ops)).toContain(`Scale 1:${page.ratio}`);
  });

  it('puts +X to the right and +Y up from the origin, and the origin note in the plot', () => {
    const ops = pages('e').pages[0]!.ops;
    expect(ops.filter((o) => o.op === 'line' && o.dash?.length === 4)).toHaveLength(2);
    const x = ops.find((o) => o.op === 'line' && o.color === 'axisX' && o.y1 === o.y2);
    const y = ops.find((o) => o.op === 'line' && o.color === 'axisY' && o.x1 === o.x2);
    expect(x?.op === 'line' && x.x2 > x.x1).toBe(true);
    expect(y?.op === 'line' && y.y2 < y.y1).toBe(true);
    expect(texts(ops)).toContain('Soundvision origin: DSE');
  });

  it('names the origin without a note', () => {
    expect(texts(pages('a', (d) => (d.job.origin = '')).pages[0]!.ops)).toContain('Soundvision origin');
  });

  it('leaves out the side labels when they are turned off, and keeps the axes and the origin', () => {
    const ops = pages('e', (d) => (d.job.sideLabels = false)).pages[0]!.ops;
    const t = texts(ops);
    for (const side of ['House left', 'House right', 'Stage', 'Audience']) expect(t).not.toContain(side);
    expect(t).toContain('Soundvision origin: DSE');
    expect(t).toContain('+X');
    expect(t).toContain('+Y');
  });

  it('labels the sides of the plan', () => {
    const t = texts(pages('a').pages[0]!.ops);
    for (const side of ['House left', 'House right', 'Stage', 'Audience']) expect(t).toContain(side);
  });

  it('draws one marker per pickup and one Position dot per array that is not a stack, dashed boxes for arrays with pickups and solid for the rest', () => {
    const { content, pages: p } = pages('a');
    const ops = p[0]!.ops;
    const flown = content.arrays.filter((a) => a.kind === 'flown');
    const stacks = content.arrays.filter((a) => a.kind === 'stacked');
    // Every array has one Position dot, a stack the same as any other, and the key repeats a dot. The key draws the 1 ton circle twice: among the four symbols and as the grey example.
    expect(ops.filter((o) => o.op === 'circle' && o.fill)).toHaveLength(flown.length + stacks.length + 1);
    expect(ops.filter((o) => o.op === 'circle' && !o.fill)).toHaveLength(content.points.length + 2);
    expect(ops.filter((o) => o.op === 'line' && o.dash?.length === 2)).toHaveLength(flown.filter((a) => a.pickups.length > 0).length * 4 + 4);
    expect(ops.filter((o) => o.op === 'line' && !o.dash && o.width === 0.25)).toHaveLength((flown.filter((a) => a.pickups.length === 0).length + stacks.length) * 4 + 8);
  });

  it('draws a ground stack as a solid box with crossed corners and the same Position dot as any array, with no number and no pickup marker', () => {
    const { content, pages: p } = pages('a');
    const ops = p[0]!.ops;
    const stacks = content.arrays.filter((a) => a.kind === 'stacked');
    expect(stacks).toHaveLength(4);
    // Two grey diagonals per stack in the plan.
    expect(ops.filter((o) => o.op === 'line' && o.color === 'grey' && o.width === 0.15 && o.x1 < 212)).toHaveLength(stacks.length * 2);
    // A stack has no hollow square: no line is drawn in the Position colour, and the key has one Position entry.
    expect(ops.filter((o) => o.op === 'line' && o.color === 'dot')).toHaveLength(0);
    const t = texts(ops);
    for (const s of stacks) expect(t).toContain(s.name);
    expect(content.points.some((pt) => stacks.some((s) => s.name === pt.source))).toBe(false);
    expect(t).toContain('Stacked array on the ground');
    expect(t.filter((x) => x === 'Position')).toHaveLength(1);
    expect(t).not.toContain('Stacked array Position');
    expect(t).not.toContain('Array Position');
  });

  it('labels an array with its name alone, with no Top site and no Position Z', () => {
    const t = texts(pages('c').pages[0]!.ops);
    expect(t).toContain('KS28 1');
    expect(t.some((x) => /^Top site|^Position Z/.test(x))).toBe(false);
  });

  it('leaves the stack keys out when no stack is drawn', () => {
    const doc = newDoc(parseFixture('c'), 'c.pdf');
    doc.job.origin = 'DSE';
    const sources = doc.result.report.sources;
    doc.noPrint = Object.fromEntries(sources.map((s, i) => [i, s.mounting === 'stacked']));
    const content = plotContent(doc, sheetModel(doc, false))!;
    expect(content.arrays.every((a) => a.kind === 'flown')).toBe(true);
    const t = texts(layoutPlotPages({ ...content, footer: () => 'f' }, estimateWidth)[0]!.ops);
    expect(t).not.toContain('Stacked array on the ground');
  });

  it('makes the Position dot smaller at small scales and never larger than 0.55 mm', () => {
    expect(dotRadiusMm(100)).toBe(0.55);
    expect(dotRadiusMm(150)).toBe(0.55);
    expect(dotRadiusMm(250)).toBeCloseTo(0.33, 6);
    expect(dotRadiusMm(2500)).toBe(0.3);
    const radius = (n: 'a' | 'e') => pages(n).pages[0]!.ops.find((o) => o.op === 'circle' && o.fill && o.cx < 212)!;
    expect((radius('a') as { r: number }).r).toBeLessThan((radius('e') as { r: number }).r);
  });

  it('labels each pickup once with its number and load, and shows no height anywhere', () => {
    const t = texts(pages('c', (d) => (d.job.defaultOffset = '0.5')).pages[0]!.ops);
    expect(t.filter((x) => x.startsWith('PA5 '))).toEqual(['PA5  379.4 kg']);
    expect(t.some((x) => /^-?\d+\.\d\d m( \(|$)/.test(x) || /^Position Z|^Top site/.test(x))).toBe(false);
  });

  it('puts the stated total weight and the plan spacing under the array name, and nothing on the front to rear line', () => {
    const { content, pages: p } = pages('c');
    const ops = p[0]!.ops;
    const t = texts(ops);
    const k1 = content.arrays.find((a) => a.pickups.length === 2)!;
    const at = (text: string) => ops.findIndex((o) => o.op === 'text' && o.text === text);
    const i = at(k1.name);
    expect(i).toBeGreaterThan(-1);
    expect(ops[i + 1]).toMatchObject({ op: 'text', text: `Total ${k1.totalWeight} kg` });
    const spacing = content.points.find((pt) => pt.arrayIndex === k1.index && pt.which === 'front')!.spacing!;
    expect(ops[i + 2]).toMatchObject({ op: 'text', text: `Spacing ${spacing.toFixed(2)} m` });
    expect(t).toContain('Total 1332.6 kg');
    expect(t).toContain('Spacing 1.01 m');
    expect(t.some((x) => /^\d+(\.\d+)? kg, /.test(x))).toBe(false);
  });

  it('leaves out the total line when the report states none, and the spacing line when there is one pickup or none', () => {
    const { content } = pages('c');
    const out = layoutPlotPages(
      { ...content, arrays: content.arrays.map((a) => ({ ...a, totalWeight: null })), footer: () => 'footer' },
      estimateWidth,
    );
    const t = texts(out[0]!.ops);
    expect(t.some((x) => x.startsWith('Total '))).toBe(false);
    expect(t.some((x) => x.startsWith('Spacing '))).toBe(true);
    const single = content.arrays.find((a) => content.points.filter((pt) => pt.arrayIndex === a.index).length === 1)!;
    expect(single).toBeDefined();
    const tt = texts(pages('c').pages[0]!.ops);
    const spacingLines = tt.filter((x) => x.startsWith('Spacing ')).length;
    const withBoth = new Set(content.points.filter((pt) => pt.which === 'front' && pt.spacing !== null).map((pt) => pt.arrayIndex)).size;
    expect(spacingLines).toBe(withBoth);
  });

  it('labels an array with one pickup once', () => {
    const { content, pages: p } = pages('c');
    const single = content.points.filter((pt) => pt.source === 'K2 SL');
    expect(single).toHaveLength(1);
    expect(texts(p[0]!.ops).filter((x) => x.startsWith(`${single[0]!.label} `))).toHaveLength(1);
  });

  it('does not number an array with no pickup', () => {
    const { content } = pages('a');
    expect(content.arrays.some((a) => a.pickups.length === 0)).toBe(true);
    expect(content.points.map((p) => p.source)).not.toContain('X8 2');
  });

  it('lists every point in the table with X and Y from the origin', () => {
    const { content, pages: p } = pages('c');
    const t = texts(p[0]!.ops);
    for (const h of ['Point', 'Array', 'Pickup', 'Load kg', 'Symbol', 'X (m)', 'Y (m)', 'Spacing', '(m)']) expect(t).toContain(h);
    for (const pt of content.points) expect(t).toContain(pt.label);
    expect(t).toContain('45.31');
  });

  it('carries the approved small print and the footer', () => {
    const t = texts(pages('a').pages[0]!.ops);
    expect(t.join(' ').replace(/\s+/g, ' ')).toContain('It is a design aid, not a definitive CAD drawing.');
    expect(t).toContain('footer 0');
  });

  it('continues the table on a second page above 24 points', () => {
    const base = pages('e').content;
    const many: Omit<PlotInput, 'footer'> = {
      ...base,
      points: Array.from({ length: 30 }, (_, i) => ({ ...base.points[i % base.points.length]!, label: `PA${i + 1}`, number: i + 1 })),
    };
    const out = layoutPlotPages({ ...many, footer: (i) => `footer ${i}` }, estimateWidth);
    expect(out).toHaveLength(2);
    expect(plotPageCount(30)).toBe(2);
    expect(plotPageCount(24)).toBe(1);
    expect(PLOT_TABLE_ROWS).toBe(24);
    expect(texts(out[0]!.ops)).toContain('PA24');
    expect(texts(out[0]!.ops)).not.toContain('PA25');
    expect(texts(out[1]!.ops)).toContain('PA25');
    expect(texts(out[1]!.ops)).toContain('PA30');
    expect(texts(out[1]!.ops)).toContain('footer 1');
  });

  it('keeps every label clear of markers, array edges, the origin lines, front to rear lines and other labels on reports A, C and E', () => {
    const problems: string[] = [];
    for (const n of ['a', 'c', 'e'] as const) {
      const ops = pages(n).pages[0]!.ops;
      const inPlan = (o: TextOp) => o.x < 212 && o.y > 15 && o.y < 176;
      // A label is one or two lines placed together; every text line is checked on its own, which is stricter.
      const boxes = ops.flatMap((o) => (o.op === 'text' && o.size === 5.5 && inPlan(o) ? [{ t: o.text, ...textBox(o) }] : []));
      const lines = ops.flatMap((o) => (o.op === 'line' && (o.color === 'ink' || o.color === 'grey') && [0.2, 0.22, 0.25].includes(o.width) ? [o] : []));
      const markers = ops.flatMap((o) => (o.op === 'circle' && !o.fill ? [o] : []));
      for (const b of boxes) {
        for (const l of lines) {
          const hit = rectHitsSegment({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }, l);
          if (hit) problems.push(`${n}: "${b.t}" is crossed by ${l.dash?.length === 4 ? 'an origin line' : 'a line'} from ${l.x1.toFixed(1)},${l.y1.toFixed(1)} to ${l.x2.toFixed(1)},${l.y2.toFixed(1)}`);
        }
        for (const m of markers) {
          const inside = b.x0 < m.cx + m.r && b.x1 > m.cx - m.r && b.y0 < m.cy + m.r && b.y1 > m.cy - m.r;
          if (inside) problems.push(`${n}: "${b.t}" covers a marker at ${m.cx.toFixed(1)},${m.cy.toFixed(1)}`);
        }
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (crosses(boxes[i]!, boxes[j]!)) problems.push(`${n}: "${boxes[i]!.t}" over "${boxes[j]!.t}"`);
        }
      }
    }
    // Report C at 1:400 packs ten stacks and other arrays into a few millimetres either side of the origin lines, so a
    // label or two there may sit across an origin line. Nothing else may clash, and reports A and E have none at all.
    const rest = problems.filter((m) => !(m.startsWith('c:') && m.includes('an origin line')));
    expect(rest).toEqual([]);
    expect(problems.filter((m) => m.startsWith('c:')).length).toBeLessThanOrEqual(1);
  });

  it('keeps every leader line off the labels, the origin lines and other leaders on reports A, C and E', () => {
    const problems: string[] = [];
    const crossing = (p: { x1: number; y1: number; x2: number; y2: number }, q: { x1: number; y1: number; x2: number; y2: number }) => {
      const d = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      return d(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1) * d(p.x1, p.y1, p.x2, p.y2, q.x2, q.y2) < -1e-9 && d(q.x1, q.y1, q.x2, q.y2, p.x1, p.y1) * d(q.x1, q.y1, q.x2, q.y2, p.x2, p.y2) < -1e-9;
    };
    let leaderCount = 0;
    for (const n of ['a', 'c', 'e'] as const) {
      const ops = pages(n).pages[0]!.ops;
      const leaders = ops.flatMap((o) => (o.op === 'line' && o.color === 'grey' && o.width === 0.12 ? [o] : []));
      const origin = ops.flatMap((o) => (o.op === 'line' && o.dash && o.dash.length === 4 ? [o] : []));
      const boxes = ops.flatMap((o) => (o.op === 'text' && o.size === 5.5 && o.x < 212 && o.y > 15 && o.y < 176 ? [{ t: o.text, ...textBox(o) }] : []));
      leaderCount += leaders.length;
      leaders.forEach((l, i) => {
        for (const b of boxes) if (!(l.x1 >= b.x0 && l.x1 <= b.x1 && l.y1 >= b.y0 && l.y1 <= b.y1) && rectHitsSegment(b, l)) problems.push(`${n}: a leader (${l.x1.toFixed(1)},${l.y1.toFixed(1)} to ${l.x2.toFixed(1)},${l.y2.toFixed(1)}) crosses "${b.t}" at ${b.x0.toFixed(1)},${b.y0.toFixed(1)}`);
        for (const o of origin) if (crossing(l, o)) problems.push(`${n}: a leader at ${l.x1.toFixed(1)},${l.y1.toFixed(1)} crosses an origin line`);
        for (const m of leaders.slice(i + 1)) if (crossing(l, m)) problems.push(`${n}: leaders at ${l.x1.toFixed(1)},${l.y1.toFixed(1)} and ${m.x1.toFixed(1)},${m.y1.toFixed(1)} cross`);
      });
    }
    // Reports A and E have no leader that crosses anything. Report C at 1:400 packs ten stacks, each
    // beside another array of the same name pattern, into a few millimetres of the origin lines, so several leaders there cross
    // an origin line or a neighbouring label. Report E has room for all of them.
    const count = (n: string) => new Set(problems.filter((m) => m.startsWith(`${n}:`)).map((m) => m.match(/\(([^)]*)\)|at ([\d.,]+)/)?.[0])).size;
    expect(leaderCount).toBeGreaterThan(0);
    expect(count('e')).toBe(0);
    expect(count('a')).toBe(0);
    expect(count('c')).toBeLessThanOrEqual(10);
  });

  it('keeps a very long array name, origin note or subtitle inside the page', () => {
    const long = 'Q'.repeat(180);
    const content = pages('c').content;
    const named = layoutPlotPages(
      { ...content, origin: long, subtitle: long, arrays: content.arrays.map((a, i) => (i === 0 ? { ...a, name: long } : a)), footer: () => 'footer' },
      estimateWidth,
    );
    for (const page of named) {
      for (const o of page.ops) {
        if (o.op !== 'text') continue;
        const b = textBox(o);
        expect(b.x0).toBeGreaterThanOrEqual(-0.01);
        expect(b.x1).toBeLessThanOrEqual(PLOT_W_MM + 0.01);
      }
    }
    expect(named[0]!.overflow).toBe(false);
  });

  it('prints the Not drawn note clear of the footer and of everything else', () => {
    const content = pages('c').content;
    const names = ['K2 SL with a rather long name', 'K2 SR with a rather long name', 'Another one', 'And more'];
    const footer = 'RigPoint Array Sheet 0.1.0 · Soundvision 2026.3.1 · Main stage.arraysheet.json (not saved) · Printed 22/10/2026 09:05 · Page 5 of 6';
    const page = layoutPlotPages({ ...content, notDrawn: names, footer: () => footer }, estimateWidth)[0]!;
    const note = page.ops.find((o): o is TextOp => o.op === 'text' && o.text.startsWith('Not drawn'));
    expect(note).toBeDefined();
    expect(note!.text).toContain('K2 SL');
    const nb = textBox(note!);
    for (const o of page.ops) {
      if (o.op !== 'text' || o === note) continue;
      expect(crosses(nb, textBox(o)), `"${o.text}" over the note`).toBe(false);
    }
  });

  it('leaves arrays off, and names them, when they cannot fit the page at the smallest scale', () => {
    const content = pages('c').content;
    const far = 5000;
    const first = content.arrays[0]!;
    const moved = content.arrays.map((a, i) =>
      i === 0 ? { ...a, position: { ...a.position, x: a.position.x + far }, corners: a.corners.map((c) => ({ ...c, x: c.x + far })) as typeof a.corners } : a,
    );
    const movedPoints = content.points.map((p) => (p.arrayIndex === first.index ? { ...p, at: { ...p.at, x: p.at.x + far } } : p));
    const page = layoutPlotPages({ ...content, arrays: moved, points: movedPoints, footer: () => 'footer' }, estimateWidth)[0]!;
    expect(page.overflow).toBe(true);
    expect(texts(page.ops).some((t) => t.startsWith('Off the page at this scale') && t.includes(first.name))).toBe(true);
    // The markers (1 mm radius at this scale, not the key's) keep clear of the table column; the table still lists every point.
    for (const o of page.ops) {
      if (o.op === 'circle' && !o.fill && o.r > 0.6 && o.r < 1.1) expect(o.cx).toBeLessThanOrEqual(210);
    }
    for (const pt of movedPoints) expect(texts(page.ops)).toContain(pt.label);
  });

  it('says so when a load is not stated, in the label and the table', () => {
    const content = pages('c').content;
    const points = content.points.map((p, i) => (i === 0 ? { ...p, load: null } : p));
    const page = layoutPlotPages({ ...content, points, footer: () => 'footer' }, estimateWidth)[0]!;
    const t = texts(page.ops);
    expect(t).toContain(`${points[0]!.label}  load not stated`);
    expect(t).toContain(NOT_STATED);
  });

  it('keeps array names that differ only at the end apart in the table, on two lines', () => {
    const content = pages('c').content;
    const stem = 'A very long array name that cannot fit';
    const points = content.points.slice(0, 2).map((p, i) => ({ ...p, source: `${stem} ${i === 0 ? 'Left' : 'Right'}` }));
    const t = texts(layoutPlotPages({ ...content, points, footer: () => 'footer' }, estimateWidth)[0]!.ops);
    expect(t.some((x) => x.endsWith('Left'))).toBe(true);
    expect(t.some((x) => x.endsWith('Right'))).toBe(true);
    expect(tableNameLines(`${stem} Left`, estimateWidth).length).toBeLessThanOrEqual(2);
    expect(tableNameLines('XZ Sym of Copy of YZ Sym of Left', estimateWidth)).toEqual(expect.arrayContaining([expect.stringMatching(/Left$/)]));
    expect(tableNameLines('Short', estimateWidth)).toEqual(['Short']);
  });

  it('uses black and grey for the axes and a black Position dot on paper, red and green on screen', () => {
    expect(PRINT_PALETTE.axisX).toBe('#000000');
    expect(PRINT_PALETTE.axisY).toBe('#555555');
    expect(PRINT_PALETTE.dot).toBe('#000000');
    expect(SCREEN_PALETTE.axisX).toBe('#d00000');
    expect(SCREEN_PALETTE.axisY).toBe('#0a8a0a');
    expect(SCREEN_PALETTE.dot).toBe('#d00000');
  });
});

describe('plotContent', () => {
  it('is null when nothing chosen can be drawn', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    doc.noPrint = Object.fromEntries(doc.result.report.sources.map((_, i) => [i, true]));
    expect(plotContent(doc, sheetModel(doc, false))).toBeNull();
  });

  it('draws only the arrays chosen for printing, and a collapsed mirror with its partner', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    const sources = doc.result.report.sources;
    const keep = sources.findIndex((s) => s.name === 'KARA II L Main');
    doc.noPrint = Object.fromEntries(sources.map((_, i) => [i, i !== keep]));
    const c = plotContent(doc, sheetModel(doc, false))!;
    expect(c.arrays.map((a) => a.name).sort()).toEqual(['KARA II L Main', 'KARA II R Main']);
  });

  it('numbers the same way as the engine', () => {
    const doc = newDoc(parseFixture('e'), 'e.pdf');
    const model = sheetModel(doc, false);
    expect(plotContent(doc, model)!.points).toEqual(numberPickups(plotArrays(doc.result.report.sources, model.printedSources).drawn));
  });
});

describe('the Pickup column of the table', () => {
  const point = { label: 'PA1', number: 1, arrayIndex: 0, source: 'A', which: 'front' as const, single: false, pickupPosition: 6, at: { x: 1, y: 2, z: 3 }, load: 100, spacing: null, marker: { shape: 'one' as const, text: '' }, custom: false };
  it('says Single for an array with one pickup, whichever side it is, and Front or Rear for a pair', () => {
    expect(tableRow({ ...point, single: true })[2]).toBe('Single');
    expect(tableRow({ ...point, single: true, which: 'rear' })[2]).toBe('Single');
    expect(tableRow(point)[2]).toBe('Front');
    expect(tableRow({ ...point, which: 'rear' })[2]).toBe('Rear');
  });
});

describe('the credit line', () => {
  it('is on every plot page, small and plain, under the page footer and clear of everything else', () => {
    for (const name of ['a', 'c', 'e'] as const) {
      for (const p of pages(name).pages) {
        const credit = p.ops.filter((o): o is TextOp => o.op === 'text' && o.text === CREDIT_TEXT);
        expect(credit, `${name} credit line`).toHaveLength(1);
        const c = credit[0] as TextOp;
        expect(c.size).toBeLessThanOrEqual(5);
        expect(c.bold).toBe(false);
        const box = textBox(c);
        expect(box.x0).toBeGreaterThanOrEqual(0);
        expect(box.x1).toBeLessThanOrEqual(PLOT_W_MM);
        expect(box.y1).toBeLessThanOrEqual(PLOT_H_MM);
        expect(c.text).not.toMatch(/[\u2013\u2014]/);
        for (const o of p.ops) if (o.op === 'text' && o !== c) expect(crosses(box, textBox(o)), `${o.text} against the credit line`).toBe(false);
      }
    }
  });
});

describe('pickup symbols on the plot', () => {
  const choose = (shape: 'two' | 'one' | 'half' | 'quarter', text = '') => ({ shape, text });

  it('are drawn in the shape chosen for each pickup, centred on it, at the marker size', () => {
    const { content, pages: p } = pages('c', (d) => {
      const i = d.result.report.sources.findIndex((s) => s.pickups.length === 2);
      d.markers = { [i]: { front: choose('two'), rear: choose('half') } };
    });
    const ops = p[0]!.ops;
    const plan = p[0]!.plan!;
    const [front, rear] = ['front', 'rear'].map((w) => content.points.find((q) => q.marker.shape === (w === 'front' ? 'two' : 'half'))!);
    expect(front?.which).toBe('front');
    expect(rear?.which).toBe('rear');
    const d = markerSizeMm(plan.ratio);
    const px = (x: number) => plan.ox + x * plan.mmPerM;
    const py = (y: number) => plan.oy - y * plan.mmPerM;
    const near = (o: PlotOp, q: NonNullable<typeof front>) => o.op === 'line' && [o.x1, o.x2].every((x) => Math.abs(x - px(q.at.x)) <= d / 2 + 0.01) && [o.y1, o.y2].every((y) => Math.abs(y - py(q.at.y)) <= d / 2 + 0.01);
    // A square with a cross is six strokes in the box of the marker, a triangle with a cross is five.
    expect(ops.filter((o) => near(o, front!) && o.op === 'line' && o.width === 0.22)).toHaveLength(6);
    expect(ops.filter((o) => near(o, rear!) && o.op === 'line' && o.width === 0.22)).toHaveLength(5);
    expect(ops.filter((o) => o.op === 'circle' && !o.fill && Math.abs(o.cx - px(front!.at.x)) < 0.01 && Math.abs(o.cy - py(front!.at.y)) < 0.01)).toHaveLength(0);
  });

  it('are drawn in black whatever the weight of the array, and in the faint grey only when they carry typed text', () => {
    const { content, pages: p } = pages('c', (d) => {
      d.markers = Object.fromEntries(d.result.report.sources.map((_, i) => [i, { front: choose('one', '1.5 t'), rear: choose('one') }]));
    });
    const plan = p[0]!.plan!;
    const px = (x: number) => plan.ox + x * plan.mmPerM;
    const py = (y: number) => plan.oy - y * plan.mmPerM;
    const circleOf = (q: (typeof content.points)[number]) => p[0]!.ops.find((o) => o.op === 'circle' && !o.fill && Math.abs(o.cx - px(q.at.x)) < 0.01 && Math.abs(o.cy - py(q.at.y)) < 0.01);
    const custom = content.points.filter((q) => q.custom);
    const plain = content.points.filter((q) => !q.custom);
    expect(custom.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(0);
    expect(custom.every((q) => q.marker.text === '1.5 t')).toBe(true);
    for (const q of custom) expect(circleOf(q)).toMatchObject({ color: 'faint' });
    for (const q of plain) expect(circleOf(q)).toMatchObject({ color: 'ink' });
    expect(PRINT_PALETTE.faint).not.toBe(PRINT_PALETTE.ink);
    expect(SCREEN_PALETTE.faint).not.toBe(SCREEN_PALETTE.grey);
  });

  it('are never greyed for being below the weight of the array: a quarter ton symbol on every array stays black', () => {
    const { content, pages: p } = pages('c', (d) => {
      d.markers = Object.fromEntries(d.result.report.sources.map((_, i) => [i, { front: choose('quarter'), rear: choose('quarter') }]));
    });
    expect(content.points.every((q) => !q.custom)).toBe(true);
    // Only the grey example in the key is left, which is outside the plan.
    expect(p[0]!.ops.filter((o) => o.op === 'line' && o.color === 'faint' && o.x1 < 212)).toHaveLength(0);
  });

  it('show their value in the Symbol column: the rating, or the text typed', () => {
    const { content } = pages('c', (d) => {
      const i = d.result.report.sources.findIndex((s) => s.pickups.length === 2);
      d.markers = { [i]: { front: choose('half'), rear: choose('one', '1.5 t') } };
    });
    const values = content.points.map((q) => tableRow(q)[4]);
    expect(values).toContain('0.5 t');
    expect(values).toContain('1.5 t');
    expect(values).toContain('1 t');
  });

  it('put typed text on its own line under the pickup label, and nothing extra when there is none', () => {
    const typed = pages('c', (d) => {
      const i = d.result.report.sources.findIndex((s) => s.pickups.length === 2);
      d.markers = { [i]: { front: choose('one', '1.5 t'), rear: choose('one') } };
    });
    // The label and the table row of each pickup that carries the text (a collapsed mirror image shares it).
    const withText = typed.content.points.filter((q) => q.marker.text === '1.5 t').length;
    expect(withText).toBeGreaterThan(0);
    expect(texts(typed.pages[0]!.ops).filter((t) => t === '1.5 t')).toHaveLength(withText * 2);
    const plain = pages('c');
    expect(texts(plain.pages[0]!.ops).filter((t) => /^\d(\.\d+)? t$/.test(t))).toHaveLength(plain.content.points.length + 4);
  });

  it('are explained in the key: the four shapes with their ratings and a note that a custom value is on the plot', () => {
    const t = texts(pages('c').pages[0]!.ops).join(' ');
    for (const label of ['2 t', '1 t', '0.5 t', '0.25 t']) expect(t).toContain(label);
    expect(t).toContain('Pickup symbols, nominal rating, a guide only');
    expect(t).toContain('Custom value noted on plot');
    expect(t).not.toContain('never grey');
    expect(t).not.toContain('Pickup, 1 t symbol');
  });

  it('give a collapsed mirror image the symbol of the card that stands for it', () => {
    const { content } = pages('a', (d) => {
      const sources = d.result.report.sources;
      const shown = sources.findIndex((s) => s.name === 'KARA II L Main');
      d.markers = { [shown]: { front: choose('two'), rear: choose('two') } };
    });
    const mirror = content.points.find((q) => q.source === 'KARA II R Main')!;
    const shown = content.points.find((q) => q.source === 'KARA II L Main')!;
    expect(shown.marker.shape).toBe('two');
    expect(mirror.marker.shape).toBe('two');
  });

  it('keep the label placer clear of every shape: no label covers a marker on a, c or e', () => {
    for (const name of ['a', 'c', 'e'] as const) {
      const { content, pages: p } = pages(name, (d) => {
        d.markers = Object.fromEntries(d.result.report.sources.map((_, i) => [i, { front: choose('two'), rear: choose('half') }]));
      });
      const plan = p[0]!.plan!;
      const half = markerSizeMm(plan.ratio) / 2;
      const boxes = p[0]!.ops.filter((o): o is TextOp => o.op === 'text' && o.size === 5.5).map(textBox);
      for (const q of content.points) {
        const cx = plan.ox + q.at.x * plan.mmPerM;
        const cy = plan.oy - q.at.y * plan.mmPerM;
        const marker = { x0: cx - half, x1: cx + half, y0: cy - half, y1: cy + half };
        for (const b of boxes) expect(crosses(b, marker), `${name} ${q.label}`).toBe(false);
      }
    }
  });
});
