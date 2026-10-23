// The date of the show, typed with a date input. It is saved as YYYY-MM-DD text and printed UK style, 23/10/2026.

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written YYYY-MM-DD. The empty string is not a date; callers allow it separately. */
export function isShowDate(text: string): boolean {
  const m = PATTERN.exec(text);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= last;
}

/** The date as printed, 23/10/2026, or an empty string when there is none or it is not a date. */
export function showDateText(text: string): string {
  const m = PATTERN.exec(text);
  return m && isShowDate(text) ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
