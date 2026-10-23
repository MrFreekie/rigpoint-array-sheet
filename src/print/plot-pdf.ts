// Draws the rigging plot's steps on a portrait PDF page, turned a quarter turn anticlockwise so the page reads
// when it is turned clockwise. The steps are in millimetres on the landscape printable area, 6 mm in from the paper.

import { degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { PT_PER_MM } from './pdf-layout';
import type { PlotOp, PlotPalette } from './plot-layout';

const MARGIN_MM = 6;

function hex(color: string) {
  const n = parseInt(color.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export function drawPlotOps(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont }, safe: (t: string) => string, ops: readonly PlotOp[], palette: PlotPalette) {
  // Landscape (x across, y down) to the portrait page: the landscape top edge is the page's left edge and the landscape left edge is its bottom.
  const PX = (y: number) => (y + MARGIN_MM) * PT_PER_MM;
  const PY = (x: number) => (x + MARGIN_MM) * PT_PER_MM;
  for (const o of ops) {
    if (o.op === 'line') {
      page.drawLine({
        start: { x: PX(o.y1), y: PY(o.x1) },
        end: { x: PX(o.y2), y: PY(o.x2) },
        thickness: o.width * PT_PER_MM,
        color: hex(palette[o.color]),
        ...(o.dash ? { dashArray: o.dash.map((d) => d * PT_PER_MM) } : {}),
      });
    } else if (o.op === 'circle') {
      const colour = hex(palette[o.color]);
      page.drawCircle({
        x: PX(o.cy),
        y: PY(o.cx),
        size: o.r * PT_PER_MM,
        borderColor: colour,
        borderWidth: o.width * PT_PER_MM,
        ...(o.fill ? { color: colour } : {}),
      });
    } else {
      const font = o.bold ? fonts.bold : fonts.regular;
      const t = safe(o.text);
      const w = font.widthOfTextAtSize(t, o.size) / PT_PER_MM;
      const startX = o.align === 'left' ? o.x : o.align === 'right' ? o.x - w : o.x - w / 2;
      const baseline = o.y + (o.size / PT_PER_MM) * 0.8;
      page.drawText(t, { x: PX(baseline), y: PY(startX), size: o.size, font, color: hex(palette[o.color]), rotate: degrees(90) });
    }
  }
}
