// Page arithmetic for the printed sheet. Each A4 page is a 2 by 2 grid of pocket cards: fold the
// page in half twice and every array is on its own A6 panel. An array too tall for a panel goes in a long column:
// the full height of the page, two to a page, folded once.

/** Printable area of an A4 page with 6 mm margins, less 1 mm so rounding never spills a blank page. */
export const PAGE_W_MM = 198;
export const PAGE_H_MM = 284;
/** The strip at the foot of the rigging page that holds its footer. Pocket panels and long columns carry their own. */
export const FOOTER_MM = 6;
/** Every pocket panel has its own header (who it is for) and footer (which version and file). */
export const PANEL_HEADER_MM = 8;
export const PANEL_FOOTER_MM = 10;
export const PX_PER_MM = 96 / 25.4;
/** Space kept clear inside each panel, at the sides and at the top and bottom. */
export const CELL_PAD_MM = 3;
export const CELL_PAD_Y_MM = 2;
export const CARDS_PER_PAGE = 4;

/** Width the card content is laid out at: half the page, less the padding. */
export const CARD_W_MM = PAGE_W_MM / 2 - 2 * CELL_PAD_MM;
/** A little room kept between a card and the footer under it, so rounding never lets them touch. */
const PANEL_GAP_MM = 0.5;
/** Height available to a card in a panel: half the page, less the padding, the header, the footer and a gap. */
export const CELL_H_MM = PAGE_H_MM / 2 - 2 * CELL_PAD_Y_MM - PANEL_HEADER_MM - PANEL_FOOTER_MM - PANEL_GAP_MM;
/** Height available to a card in a long column: the page, less the padding, the header, the footer and a gap. */
export const LONG_H_MM = PAGE_H_MM - 2 * CELL_PAD_Y_MM - PANEL_HEADER_MM - PANEL_FOOTER_MM - PANEL_GAP_MM;
/** Height available to the rigging page, which has the page footer strip and no panel header of its own. It keeps its own 11 mm of head room. */
export const FULL_H_MM = PAGE_H_MM - FOOTER_MM - 2 * CELL_PAD_MM - 11;

/** A long column may shrink this far before the card is allowed to run on. */
export const MIN_FULL_SCALE = 0.5;

const mmToPx = (mm: number) => mm * PX_PER_MM;

export interface Fit {
  scale: number;
  /** True when the content does not fit even at the smallest allowed scale. */
  overflow: boolean;
}

/** The scale that fits content of `contentPx` height into `boxMm`, never above 1 and never below `min`. */
export function fitScale(contentPx: number, boxMm: number, min: number): Fit {
  if (!(contentPx > 0)) return { scale: 1, overflow: false };
  const needed = Math.min(1, mmToPx(boxMm) / contentPx);
  return { scale: Math.max(min, Math.floor(needed * 1000) / 1000), overflow: needed < min };
}

export type PagePlan<T> =
  | { kind: 'grid'; cards: { item: T; scale: number }[] }
  | { kind: 'long'; cards: { item: T; scale: number; overflow: boolean }[] };

/**
 * Lays cards out in the order given. A card that fits a pocket panel at full size goes four to a grid page.
 * A taller one goes in a long column, two to a page. A card that cannot fit a long column even at the
 * smallest scale has a long page to itself. Long pages come first, then grid pages, each in report order.
 */
export function planPages<T>(items: readonly { item: T; heightPx: number }[]): PagePlan<T>[] {
  const grids: PagePlan<T>[] = [];
  const longs: PagePlan<T>[] = [];
  let grid: { item: T; scale: number }[] = [];
  let pair: { item: T; scale: number; overflow: boolean }[] = [];
  const closeGrid = () => {
    if (grid.length > 0) grids.push({ kind: 'grid', cards: grid });
    grid = [];
  };
  const closePair = () => {
    if (pair.length > 0) longs.push({ kind: 'long', cards: pair });
    pair = [];
  };
  for (const { item, heightPx } of items) {
    if (!(heightPx > mmToPx(CELL_H_MM))) {
      grid.push({ item, scale: 1 });
      if (grid.length === CARDS_PER_PAGE) closeGrid();
      continue;
    }
    const long = fitScale(heightPx, LONG_H_MM, MIN_FULL_SCALE);
    if (long.overflow) {
      closePair();
      longs.push({ kind: 'long', cards: [{ item, scale: long.scale, overflow: true }] });
    } else {
      pair.push({ item, scale: long.scale, overflow: false });
      if (pair.length === 2) closePair();
    }
  }
  closeGrid();
  closePair();
  return [...longs, ...grids];
}
