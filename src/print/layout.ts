// Page arithmetic for the printed sheet. Each A4 page is a 2 by 2 grid of pocket cards: fold the
// page in half twice and every array is on its own A6 panel. An array too tall for a panel gets a page to itself.

/** Printable area of an A4 page with 6 mm margins, less 1 mm so rounding never spills a blank page. */
export const PAGE_W_MM = 198;
export const PAGE_H_MM = 284;
/** The strip at the foot of a full page or the rigging page that holds the footer. */
export const FOOTER_MM = 6;
/** Every pocket panel has its own header (who it is for) and footer (which version and file). */
export const PANEL_HEADER_MM = 11;
export const PANEL_FOOTER_MM = 8;
export const PX_PER_MM = 96 / 25.4;
/** Space kept clear inside each panel, on every side. */
export const CELL_PAD_MM = 3;
export const CARDS_PER_PAGE = 4;

/** Width the card content is laid out at: half the page, less the padding. */
export const CARD_W_MM = PAGE_W_MM / 2 - 2 * CELL_PAD_MM;
/** A little room kept between a card and the footer under it, so rounding never lets them touch. */
const PANEL_GAP_MM = 1;
/** Height available to a card in a panel: half the page, less the padding, the header, the footer and a gap. */
export const CELL_H_MM = PAGE_H_MM / 2 - 2 * CELL_PAD_MM - PANEL_HEADER_MM - PANEL_FOOTER_MM - PANEL_GAP_MM;
/** Height available to a card that has a whole page, under its own header. */
export const FULL_H_MM = PAGE_H_MM - FOOTER_MM - 2 * CELL_PAD_MM - PANEL_HEADER_MM;

/** Below this the text is too small to read, so the card is moved to a page of its own. */
export const MIN_SCALE = 0.72;
/** Even a whole page may shrink this far before the card is allowed to run on. */
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
  | { kind: 'full'; item: T; scale: number; overflow: boolean };

/**
 * Lays cards out in the order given, four to a page. A card that would need to shrink below
 * MIN_SCALE to fit a panel takes a page of its own, and the grid page before it is closed early.
 */
export function planPages<T>(items: readonly { item: T; heightPx: number }[]): PagePlan<T>[] {
  const pages: PagePlan<T>[] = [];
  let grid: { item: T; scale: number }[] = [];
  const closeGrid = () => {
    if (grid.length > 0) pages.push({ kind: 'grid', cards: grid });
    grid = [];
  };
  for (const { item, heightPx } of items) {
    const cell = fitScale(heightPx, CELL_H_MM, MIN_SCALE);
    if (!cell.overflow) {
      grid.push({ item, scale: cell.scale });
      if (grid.length === CARDS_PER_PAGE) closeGrid();
    } else {
      closeGrid();
      const full = fitScale(heightPx, FULL_H_MM, MIN_FULL_SCALE);
      pages.push({ kind: 'full', item, scale: full.scale, overflow: full.overflow });
    }
  }
  closeGrid();
  return pages;
}
