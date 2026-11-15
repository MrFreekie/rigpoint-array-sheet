// Pickup to max depth: how far the rear of an array lies behind its pickup, in metres. Soundvision shows it but the report does
// not carry it, so the person types it for each array that has a pickup. With it the array's outline can be drawn: its rear edge
// is this far behind the pickup (the rear pickup when there are two), and its front edge is the report's depth in front of that.

/** The largest pickup to max depth the app accepts, in metres. */
export const DEPTH_MAX_M = 20;

/** The typed text as metres, or null for blank and for text that is not a depth above zero, to 2 decimals, up to the maximum. */
export function parseDepthM(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= DEPTH_MAX_M ? n : null;
}

/** True when the text is blank or a depth. */
export function isValidDepth(text: string): boolean {
  return text.trim() === '' || parseDepthM(text) !== null;
}

/** What the person is allowed to type: digits, then a point or comma, then at most 2 decimals. */
export function isTypingDepth(text: string): boolean {
  return /^\d{0,2}([.,]\d{0,2})?$/.test(text);
}

/** The text saved in the file: blank, or the depth written plainly (1.5 not 1,50). */
export function canonicalDepth(text: string): string {
  const n = parseDepthM(text);
  return n === null ? '' : String(n);
}
