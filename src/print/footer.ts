// The footer on every printout and image: ties the paper back to the app version, the report and the file.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatStamp(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
