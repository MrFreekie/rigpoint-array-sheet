// The spacing of the grid on the rigging plot. Typed in Settings, in metres, and kept in the file.

export const GRID_DEFAULT_M = 10;
export const GRID_MIN_M = 1;
export const GRID_MAX_M = 100;

/** A grid size typed in Settings: a number of metres from 1 to 100, in steps as fine as 0.5. Null for anything else. */
export function parseGridM(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n >= GRID_MIN_M && n <= GRID_MAX_M ? n : null;
}

/** The size as written on the plot and in Settings, without a trailing .0. */
export function gridText(m: number): string {
  return String(Number(m.toFixed(2)));
}
