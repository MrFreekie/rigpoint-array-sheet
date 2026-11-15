import { isShowDate } from './show-date';

// Suggested names for saved files, e.g. "2026-11-15 - Main stage - Example Theatre (Rev B 2026-11-20).arraysheet.json".

export const FILE_SUFFIX = '.arraysheet.json';

/** Removes characters that Windows, macOS or Linux would not accept in a file name. */
export function safeName(text: string, max = 80): string {
  const cleaned = Array.from(text)
    .map((ch) => (ch.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, max)
    .trim();
  return cleaned === '' ? 'Array sheet' : cleaned;
}

export function suggestedImageName(show: string, array: string): string {
  return `${safeName(show.replace(/\.xmlp$/i, ''))} - ${safeName(array)}.png`;
}

/** The longest name a saved file is suggested with, before its revision and extension. */
const NAME_MAX = 160;

/** Today as YYYY-MM-DD, in the person's own time zone. */
export function localDateText(now: Date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/**
 * The name a document is saved under, before the revision: the show date as YYYY-MM-DD, the show name and the venue, each left
 * out when blank, joined by " - ". `fallback` stands in for a blank show name.
 */
export function fileTitle(job: { show: string; venue: string; showDate: string }, fallback: string): string {
  const parts = [isShowDate(job.showDate) ? job.showDate : '', job.show.trim() || fallback, job.venue.trim()].map((t) => t.replace(/\.xmlp$/i, '').trim());
  return parts
    .filter((t) => t !== '')
    .map((t) => safeName(t))
    .join(' - ');
}

/** The revision as it follows the name: " (Rev C 2026-11-15)" with the day it was saved, or " - Rev C" when no day is given. */
function revisionSuffix(revision: string, savedOn?: string): string {
  if (!revision) return '';
  return savedOn ? ` (Rev ${revision} ${savedOn})` : ` - Rev ${revision}`;
}

const baseOf = (title: string) => safeName(title.replace(/\.xmlp$/i, ''), NAME_MAX);

export function suggestedPdfName(title: string, revision: string, savedOn?: string): string {
  return `${baseOf(title)}${revisionSuffix(revision, savedOn)}.pdf`;
}

export function suggestedFileName(title: string, revision: string, savedOn?: string): string {
  return `${baseOf(title)}${revisionSuffix(revision, savedOn)}${FILE_SUFFIX}`;
}

export function suggestedDxfName(title: string, revision: string, savedOn?: string): string {
  return `${baseOf(title)}${revisionSuffix(revision, savedOn)}.dxf`;
}

/** The rigging plot as a PNG: the name, the revision and "Rigging plot". */
export function suggestedPlotImageName(title: string, revision: string, savedOn?: string): string {
  return `${baseOf(title)}${revisionSuffix(revision, savedOn)} - Rigging plot.png`;
}

/** The tuning sheet: the name, the revision and "Tuning sheet", as a PDF or a PNG. */
export function suggestedTuningName(title: string, revision: string, extension: 'pdf' | 'png', savedOn?: string): string {
  return `${baseOf(title)}${revisionSuffix(revision, savedOn)} - Tuning sheet.${extension}`;
}
