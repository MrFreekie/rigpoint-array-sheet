// A PNG of one array's card. The card is laid out as a list of drawing steps (pure, so it can be
// tested without a browser) and then drawn on a canvas. Drawing text on a canvas needs no markup, so
// it works under the strict Content Security Policy.

import type { CardContent } from './card-content';

export const IMAGE_W = 640;
const PAD = 28;
const FONT = "Arial, Helvetica, 'Liberation Sans', sans-serif";

export type DrawOp =
  | { op: 'text'; x: number; y: number; text: string; size: number; bold: boolean; align: 'left' | 'right' | 'center'; color: string; rotate?: number }
  | { op: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; color: string }
  | { op: 'rect'; x: number; y: number; w: number; h: number; fill: string | null; stroke: string | null; lineWidth: number };

export interface ImageLayout {
  width: number;
  height: number;
  ops: DrawOp[];
}

/** Width of text in pixels at a size. The browser version measures real text; tests use an estimate. */
export type Measure = (text: string, size: number, bold: boolean) => number;

export const estimateWidth: Measure = (text, size, bold) => text.length * size * (bold ? 0.6 : 0.55);

export function canvasFont(size: number, bold: boolean): string {
  return `${bold ? 'bold ' : ''}${size}px ${FONT}`;
}

/** Breaks text into lines no wider than `max`, at spaces where possible and inside a word if it is too long. */
export function wrap(text: string, size: number, bold: boolean, max: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const trial = line ? `${line} ${word}` : word;
    if (measure(trial, size, bold) <= max) {
      line = trial;
      continue;
    }
    if (line) lines.push(line);
    let rest = word;
    while (measure(rest, size, bold) > max && rest.length > 1) {
      let n = rest.length - 1;
      while (n > 1 && measure(rest.slice(0, n), size, bold) > max) n--;
      lines.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

export interface ImageOptions {
  /** Footer text, e.g. which file and when it was exported. */
  footer: string;
  draft: boolean;
}

export function layoutCardImage(content: CardContent, options: ImageOptions, measure: Measure = estimateWidth): ImageLayout {
  const inner = IMAGE_W - 2 * PAD;
  const ops: DrawOp[] = [];
  let y = PAD;

  const text = (t: string, size: number, opts: { bold?: boolean; color?: string; x?: number; align?: 'left' | 'right' | 'center'; yy?: number } = {}) =>
    ops.push({ op: 'text', x: opts.x ?? PAD, y: opts.yy ?? y, text: t, size, bold: opts.bold ?? false, align: opts.align ?? 'left', color: opts.color ?? '#000' });
  const paragraph = (t: string, size: number, opts: { bold?: boolean; color?: string; gap?: number } = {}) => {
    for (const line of wrap(t, size, opts.bold ?? false, inner, measure)) {
      text(line, size, opts);
      y += Math.round(size * 1.3);
    }
    y += opts.gap ?? 0;
  };

  paragraph(content.title, 26, { bold: true, gap: 2 });
  paragraph(content.subtitle, 14, { gap: 2 });
  if (content.context) paragraph(content.context, 12, { color: '#444', gap: 8 });
  else y += 6;

  const box = (lines: { text: string; bold: boolean }[], lineWidth: number) => {
    const size = 12;
    const wrapped = lines.flatMap((l) => wrap(l.text, size, l.bold, inner - 16, measure).map((t) => ({ text: t, bold: l.bold })));
    const h = wrapped.length * Math.round(size * 1.35) + 12;
    ops.push({ op: 'rect', x: PAD, y, w: inner, h, fill: null, stroke: '#000', lineWidth });
    let ty = y + 6;
    for (const l of wrapped) {
      text(l.text, size, { bold: l.bold, x: PAD + 8, yy: ty });
      ty += Math.round(size * 1.35);
    }
    y += h + 8;
  };

  if (content.mirrorNote) box([{ text: content.mirrorNote, bold: true }], 1);
  for (const w of content.warnings) {
    box(
      [{ text: `${w.severity} ${w.title}`, bold: true }, ...(w.message ? [{ text: w.message, bold: false }] : [])],
      3,
    );
  }

  // Facts: label on the left, value on the right, a light line under each.
  const rowH = 25;
  for (const [label, value] of content.facts) {
    text(label, 14, { yy: y + 3 });
    text(value, 14, { bold: true, x: IMAGE_W - PAD, align: 'right', yy: y + 3 });
    ops.push({ op: 'line', x1: PAD, y1: y + rowH, x2: IMAGE_W - PAD, y2: y + rowH, width: 1, color: '#bbb' });
    y += rowH;
  }
  y += 14;

  // Enclosure table. Type takes whatever the fixed columns leave.
  const fixed: Record<string, number> = { '#': 46, Panflex: 110, Angle: 86, Site: 96 };
  const widths = content.columns.map((c) => fixed[c] ?? 0);
  const typeIndex = content.columns.indexOf('Type');
  widths[typeIndex] = inner - widths.reduce((a, b) => a + b, 0);
  const xs = widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? PAD) + w], [PAD]);
  const tableRow = (cells: string[], header: boolean) => {
    if (header) ops.push({ op: 'rect', x: PAD, y, w: inner, h: rowH, fill: '#e4e4e4', stroke: null, lineWidth: 0 });
    cells.forEach((cell, i) => {
      const left = i === typeIndex || false;
      text(cell, 14, {
        bold: header || i === 0,
        x: left ? (xs[i] ?? PAD) + 8 : (xs[i + 1] ?? IMAGE_W - PAD) - 8,
        align: left ? 'left' : 'right',
        yy: y + 3,
      });
    });
    ops.push({ op: 'line', x1: PAD, y1: y + rowH, x2: IMAGE_W - PAD, y2: y + rowH, width: header ? 2 : 1, color: header ? '#000' : '#777' });
    y += rowH;
  };
  tableRow(content.columns, true);
  for (const row of content.rows) tableRow(row, false);
  y += 16;

  // Footer: which file, which version, when.
  for (const line of wrap(options.footer, 11, false, inner, measure)) {
    text(line, 11, { color: '#333' });
    y += 15;
  }
  y += PAD - 10;

  const height = Math.max(y, 200);
  if (options.draft) {
    ops.push({
      op: 'text', x: IMAGE_W / 2, y: height / 2 - 60, text: 'DRAFT', size: 150, bold: true, align: 'center', color: 'rgba(0,0,0,0.07)', rotate: -35,
    });
  }
  return { width: IMAGE_W, height, ops };
}

/** Draws a layout on a canvas context. Text is drawn from its top edge. */
export function drawLayout(ctx: CanvasRenderingContext2D, layout: ImageLayout): void {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = 'top';
  for (const o of layout.ops) {
    if (o.op === 'rect') {
      if (o.fill) {
        ctx.fillStyle = o.fill;
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }
      if (o.stroke) {
        ctx.strokeStyle = o.stroke;
        ctx.lineWidth = o.lineWidth;
        ctx.strokeRect(o.x + o.lineWidth / 2, o.y + o.lineWidth / 2, o.w - o.lineWidth, o.h - o.lineWidth);
      }
    } else if (o.op === 'line') {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = o.width;
      ctx.beginPath();
      ctx.moveTo(o.x1, o.y1 + 0.5);
      ctx.lineTo(o.x2, o.y2 + 0.5);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.font = canvasFont(o.size, o.bold);
      ctx.fillStyle = o.color;
      ctx.textAlign = o.align;
      if (o.rotate) {
        ctx.translate(o.x, o.y + o.size / 2);
        ctx.rotate((o.rotate * Math.PI) / 180);
        ctx.fillText(o.text, 0, -o.size / 2);
      } else {
        ctx.fillText(o.text, o.x, o.y);
      }
      ctx.restore();
    }
  }
}

/** A PNG of the card, at twice the layout size so it stays sharp on a phone. */
export async function cardImageBlob(content: CardContent, options: ImageOptions, scale = 2): Promise<Blob> {
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('This browser cannot draw images.');
  const measure: Measure = (t, size, bold) => {
    probe.font = canvasFont(size, bold);
    return probe.measureText(t).width;
  };
  const layout = layoutCardImage(content, options, measure);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw images.');
  ctx.scale(scale, scale);
  drawLayout(ctx, layout);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be made.'))), 'image/png');
  });
}
