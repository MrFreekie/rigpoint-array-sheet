// Draws a report as the text items a Soundvision PDF would give, in the same layout
// (same columns, repeated table heading after a page break, "Page n of N" footers).
// Used to test the parser on many reports it has never seen.

import type { ArraySource, ReportDocument, TextItem } from '../engine/types';

const TOP = 780;
const STEP = 18;
const BOTTOM = 80;
const COLUMN_RIGHT = { angle: 240, site: 296, topZ: 370, bottomZ: 460 };
const CHAR = 6.6;

interface Cell {
  x: number;
  text: string;
}

export interface RenderedSource extends ArraySource {
  /** Group heading lines to print before this source, e.g. ["1. Group: MAINS"]. */
  groupLines?: string[];
}

export function renderReport(document: ReportDocument, sources: RenderedSource[], pageLength = 38): TextItem[] {
  const lines: { cells: Cell[]; table?: boolean }[] = [];
  const line = (text: string, x = 71) => lines.push({ cells: [{ x, text }] });
  const f = (n: number) => String(n);

  line('Soundvision', 350);
  line(`Version: ${document.version ?? ''}`, 430);
  line(`Author: ${document.author ?? ''}`, 428);
  line(`Date: ${document.date ?? ''}`, 432);
  line(`File name: ${document.fileName ?? ''}`, 238);
  line('Comments: Comments');
  lines.push({ cells: [{ x: 73, text: 'Distance unit:' }, { x: 154, text: document.distanceUnit ?? '' }] });
  lines.push({ cells: [{ x: 73, text: 'Weight unit:' }, { x: 154, text: document.weightUnit ?? '' }] });

  const header = (hasAngles: boolean): Cell[] => [
    { x: 85, text: '#' },
    { x: 123, text: 'Type' },
    ...(hasAngles ? [{ x: 178, text: 'Angles (°)' }] : []),
    { x: 252, text: 'Site (°)' },
    { x: 309, text: 'Top Z (m)' },
    { x: 383, text: 'Bottom Z (m)' },
    { x: 473, text: 'Panflex' },
  ];
  const right = (text: string, edge: number): Cell => ({ x: edge - CHAR * text.length, text });

  sources.forEach((s, index) => {
    for (const g of s.groupLines ?? []) line(g);
    line(`${s.number}. Source: ${s.name}`);
    line(`${s.number}. 1. Physical configuration`);
    if (s.configuration) line(`Configuration: ${s.configuration}`);
    if (s.bumper) line(`Bumper: ${s.bumper}`);
    if (s.motors !== null) line(`# motors: ${s.motors}`);
    for (const p of s.pickups) {
      line(`${p.which === 'front' ? 'Front' : 'Rear'} pickup position (X; Y; Z, m): ${p.position} (${f(p.at.x)}; ${f(p.at.y)}; ${f(p.at.z)})`);
    }
    if (s.position) line(`Position (X; Y; Z, m): ${f(s.position.x)}; ${f(s.position.y)}; ${f(s.position.z)}`);
    if (s.site !== null) line(`Site: ${f(s.site)} °`);
    if (s.azimuth !== null) line(`Azimuth: ${f(s.azimuth)} °`);
    if (s.dimensions) line(`Spatial dimensions (X; Y; Z, m): ${f(s.dimensions.x)}; ${f(s.dimensions.y)}; ${f(s.dimensions.z)}`);
    if (s.bottomElevation !== null) line(`Bottom elevation: ${f(s.bottomElevation)} m`);
    if (s.topSite !== null) line(`Top site: ${f(s.topSite)} °`);
    if (s.bottomSite !== null) line(`Bottom site: ${f(s.bottomSite)} °`);
    if (s.weights.total !== null) line(`Total weight (Enclosures + Frames): ${f(s.weights.total)} kg`);
    if (s.weights.enclosures !== null) line(`Total enclosure weight: ${f(s.weights.enclosures)} kg`);
    if (s.weights.frontMotorLoad !== null) line(`Front motor load: ${f(s.weights.frontMotorLoad)} kg`);
    if (s.weights.rearMotorLoad !== null) line(`Rear motor load: ${f(s.weights.rearMotorLoad)} kg`);
    if (s.warnings.length > 0) {
      line('Mechanical warnings:');
      for (const w of s.warnings) {
        line(w.severity, 78);
        line(w.title, 78);
        line(w.message, 78);
      }
    }
    const hasAngles = s.cabinets.some((c) => c.angle !== null);
    if (s.cabinets.length > 0) {
      lines.push({ cells: header(hasAngles), table: true });
      for (const c of s.cabinets) {
        const cells: Cell[] = [{ x: 73, text: c.column ? `C${c.column} #${c.number}` : `#${c.number}` }, { x: 107, text: c.type }];
        if (c.angle !== null) cells.push(right(f(c.angle), COLUMN_RIGHT.angle));
        if (c.site !== null) cells.push(right(f(c.site), COLUMN_RIGHT.site));
        if (c.topZ !== null) cells.push(right(f(c.topZ), COLUMN_RIGHT.topZ));
        if (c.bottomZ !== null) cells.push(right(f(c.bottomZ), COLUMN_RIGHT.bottomZ));
        if (c.panflex !== null) cells.push({ x: 491, text: c.panflex });
        lines.push({ cells, table: true });
      }
    }
    line(`${s.number}. 2. Acoustic configuration`);
    line('Autofilter active - Default');
    line('Enclosure #1 - KARA II');
    line('FIR 1 (1250 Hz): -1 dB');
    line(index % 2 === 0 ? 'None' : 'Delay: 4.17 ms');
  });

  // Lay the lines out on pages.
  const pages: { cells: Cell[]; y: number }[][] = [[]];
  let y = TOP;
  let currentHeader: Cell[] = [];
  for (const l of lines) {
    if (l.table && l.cells[0]?.text === '#') currentHeader = l.cells;
    if (y < BOTTOM || (pages[pages.length - 1]?.length ?? 0) >= pageLength) {
      pages.push([]);
      y = TOP;
      if (l.table && l.cells[0]?.text !== '#') {
        pages[pages.length - 1]?.push({ cells: currentHeader, y });
        y -= STEP;
      }
    }
    pages[pages.length - 1]?.push({ cells: l.cells, y });
    y -= STEP;
  }

  const items: TextItem[] = [];
  pages.forEach((page, p) => {
    for (const l of page) for (const c of l.cells) items.push({ page: p + 1, x: c.x, y: l.y, text: c.text });
    items.push({ page: p + 1, x: 456, y: 51, text: `Page ${p + 1} of ${pages.length}` });
  });
  return items;
}
