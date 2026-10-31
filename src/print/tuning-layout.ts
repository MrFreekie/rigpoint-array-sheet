// The tuning sheet laid out as drawing steps: a small table of what the report states for each array. Pure, so it can be tested
// without a browser. The PDF draws it on landscape A4 pages and the image draws it on one canvas, both from this one layout.
// The rows come from src/ui/tuning-rows.ts. Nothing here is part of the pocket cards or the main PDF.

import { CREDIT_TEXT } from './footer';
import { clipToWidth, wrap, type DrawOp, type ImageLayout, type Measure } from './array-image';
import type { PanelHeader } from './panel-header';
import { TUNING_COLUMNS, TUNING_FOOTNOTE, type TuningRow } from '../ui/tuning-rows';

export const TUNING_TITLE = 'Tuning sheet';

export interface TuningSheetInput {
  header: PanelHeader;
  rows: readonly TuningRow[];
  /** The footer line of a page. The page number and the total are given so the PDF can print them. */
  footer: (page: number, total: number) => string;
}

export interface TuningGeometry {
  width: number;
  /** The height of a page, or null for one page as tall as the table needs. */
  height: number | null;
  /** The size of the main text. The smaller lines and the footer follow from it. */
  font: number;
  margin: number;
}

/** Columns whose text wraps when the table is too wide: the others keep one line a cell. */
const WRAPS = new Set([0, 3]);
const MIN_WRAP_WIDTH = 70;

/** A line that names a group and gives its figure: "SUBS: 6 ms" is the name "SUBS" and the figure "6 ms". */
const GROUP_FIGURE = /^((?:.*)): (\S+ \S+)$/;

const GREY = '#444';

export function layoutTuningPages(input: TuningSheetInput, measure: Measure, geometry: TuningGeometry): ImageLayout[] {
  const { width, margin, font } = geometry;
  const small = font * 0.8;
  const foot = font * 0.7;
  const padX = font * 0.5;
  const padY = font * 0.35;
  const sizeOf = (l: { small: boolean }) => (l.small ? small : font);
  const lineH = (size: number) => size * 1.3;
  const inner = width - 2 * margin;

  // Column widths. A figure is never cut: the columns that hold figures keep the width of their widest figure, and the Array and
  // Autofilter columns, and the lines that name a group, wrap to take up what the page is short of.
  const bold = (c: number, l: { small: boolean }) => c === 0 && !l.small;
  const groupLine = (c: number, l: { text: string; small: boolean }) => (l.small && (c === 1 || c === 2) ? GROUP_FIGURE.exec(l.text) : null);
  const need = (c: number, keep: boolean) =>
    Math.max(
      measure(TUNING_COLUMNS[c] ?? '', font, true),
      ...input.rows.flatMap((r) =>
        (r.cells[c] ?? []).map((l) => {
          const figure = groupLine(c, l)?.[2];
          if (figure !== undefined) return keep ? measure(figure, sizeOf(l), false) : measure(l.text, sizeOf(l), false);
          return WRAPS.has(c) && keep ? 0 : measure(l.text, sizeOf(l), bold(c, l));
        }),
      ),
    ) + 2 * padX;
  const natural = TUNING_COLUMNS.map((_, c) => need(c, false));
  const hasGroupLines = (c: number) => input.rows.some((r) => (r.cells[c] ?? []).some((l) => groupLine(c, l)));
  const floors = TUNING_COLUMNS.map((_, c) => Math.max(need(c, true), WRAPS.has(c) || hasGroupLines(c) ? MIN_WRAP_WIDTH : 0));
  const slack = natural.map((w, c) => Math.max(w - (floors[c] ?? w), 0));
  const slackSum = slack.reduce((a, b) => a + b, 0);
  const over = Math.min(Math.max(natural.reduce((a, b) => a + b, 0) - inner, 0), slackSum);
  const colW = natural.map((w, c) => w - (slackSum > 0 ? (over * (slack[c] ?? 0)) / slackSum : 0));
  const xs = colW.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? margin) + w], [margin]);
  const right = xs[xs.length - 1] ?? margin;

  // Each row's lines, wrapped to its column, and the row's height. A group's figure stays whole on its last line.
  const laid = input.rows.map((r) => {
    const cells = TUNING_COLUMNS.map((_, c) =>
      (r.cells[c] ?? []).flatMap((l) => {
        const size = sizeOf(l);
        const max = (colW[c] ?? 0) - 2 * padX;
        const group = groupLine(c, l);
        let lines = [l.text];
        if (WRAPS.has(c)) {
          lines = wrap(l.text, size, bold(c, l), max, measure);
        } else if (group) {
          lines = wrap(`${group[1]}:`, size, false, max, measure);
          const last = lines[lines.length - 1] ?? '';
          if (measure(`${last} ${group[2]}`, size, false) <= max) lines[lines.length - 1] = `${last} ${group[2]}`;
          else lines.push(group[2] ?? '');
        }
        return lines.map((text) => ({ text, size, small: l.small, bold: bold(c, l) }));
      }),
    );
    const height = Math.max(...cells.map((lines) => lines.reduce((h, l) => h + lineH(l.size), 0)), lineH(font)) + 2 * padY;
    return { cells, height };
  });

  const headerH = lineH(font) + 2 * padY;
  const topBlockH = lineH(font * 1.6) + lineH(font) + (input.header.details ? lineH(small) : 0) + font * 0.8;
  const footerH = 2 * lineH(foot) + font * 0.5;
  const noteH = lineH(small) + font * 0.5;
  const limit = geometry.height === null ? Infinity : geometry.height - margin - footerH;

  // Share the rows out over the pages: the heading row repeats at the top of each, and the footnote follows the last row.
  const pages: (typeof laid)[] = [[]];
  let y = margin + topBlockH + headerH;
  for (const row of laid) {
    const page = pages[pages.length - 1] as typeof laid;
    if (page.length > 0 && y + row.height > limit) {
      pages.push([]);
      y = margin + topBlockH + headerH;
    }
    (pages[pages.length - 1] as typeof laid).push(row);
    y += row.height;
  }
  if (y + noteH > limit) pages.push([]);

  return pages.map((rows, n) => {
    const ops: DrawOp[] = [];
    const text = (t: string, x: number, yy: number, size: number, o: { bold?: boolean; align?: 'left' | 'right' | 'center'; color?: string } = {}) =>
      ops.push({ op: 'text', x, y: yy, text: t, size, bold: o.bold ?? false, align: o.align ?? 'left', color: o.color ?? '#000' });

    let top = margin;
    const status = input.header.status.toUpperCase();
    text(clipToWidth(TUNING_TITLE, font * 1.6, true, inner, measure), margin, top, font * 1.6, { bold: true });
    text(status, width - margin, top + font * 0.4, small, { bold: true, align: 'right' });
    top += lineH(font * 1.6);
    text(clipToWidth(input.header.title, font, false, inner, measure), margin, top, font);
    top += lineH(font);
    if (input.header.details) {
      text(clipToWidth(input.header.details, small, false, inner, measure), margin, top, small, { color: GREY });
      top += lineH(small);
    }
    top += font * 0.8;

    // The heading row.
    ops.push({ op: 'rect', x: margin, y: top, w: right - margin, h: headerH, fill: '#e4e4e4', stroke: null, lineWidth: 0 });
    TUNING_COLUMNS.forEach((heading, c) => text(heading, (xs[c] ?? margin) + padX, top + padY, font, { bold: true }));
    ops.push({ op: 'line', x1: margin, y1: top + headerH, x2: right, y2: top + headerH, width: 1.5, color: '#000' });
    top += headerH;

    for (const row of rows) {
      row.cells.forEach((lines, c) => {
        let yy = top + padY;
        for (const l of lines) {
          text(l.text, (xs[c] ?? margin) + padX, yy, l.size, { bold: l.bold, color: l.small ? GREY : '#000' });
          yy += lineH(l.size);
        }
      });
      ops.push({ op: 'line', x1: margin, y1: top + row.height, x2: right, y2: top + row.height, width: 0.7, color: '#777' });
      top += row.height;
    }

    if (n === pages.length - 1) text(TUNING_FOOTNOTE, margin, top + font * 0.4, small, { color: GREY });

    const bottom = geometry.height ?? top + noteH + footerH + margin;
    const footY = bottom - margin - footerH + font * 0.5;
    text(clipToWidth(input.footer(n + 1, pages.length), foot, false, inner, measure), margin, footY, foot, { color: '#333' });
    text(CREDIT_TEXT, margin, footY + lineH(foot), foot, { color: '#333' });
    return { width, height: bottom, ops };
  });
}
