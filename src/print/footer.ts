// The footer on every printout and image: ties the paper back to the app version, the report and the file.

import { APP_URL } from '../app-info';

/** The line under the footer on pocket cards and card images. Plain text, no dash. */
export const CREDIT_TEXT = `Created with RigPoint Array Sheet. Find it at ${APP_URL}`;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatStamp(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A footer with its page number, and how many items still need checking against the Soundvision report. */
export function pageFooterText(footer: string, checks: number, page: number, total: number): string {
  return `${footer}${checks > 0 ? ` · ${checks} to check against the PDF` : ''} · Page ${page} of ${total}`;
}

export function printFooter(opts: {
  appVersion: string;
  /** The Soundvision version the report states, or null. */
  soundvisionVersion: string | null;
  /** The file this was last saved to or opened from, or null if it never was. */
  fileName: string | null;
  /** What the file would be called if saved now. */
  defaultName: string;
  dirty: boolean;
  printedAt: Date;
  verb?: 'Printed' | 'Exported';
}): string {
  const file = opts.fileName
    ? `${opts.fileName}${opts.dirty ? ' (unsaved changes)' : ''}`
    : `${opts.defaultName} (not saved)`;
  const sv = opts.soundvisionVersion ? ` · Soundvision ${opts.soundvisionVersion}` : '';
  return `RigPoint Array ${opts.appVersion}${sv} · ${file} · ${opts.verb ?? 'Printed'} ${formatStamp(opts.printedAt)}`;
}
