// Suggested names for saved files, e.g. "Main stage - Rev B.arraysheet.json".

export const FILE_SUFFIX = '.arraysheet.json';

/** Removes characters that Windows, macOS or Linux would not accept in a file name. */
export function safeName(text: string): string {
  const cleaned = Array.from(text)
    .map((ch) => (ch.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 80)
    .trim();
  return cleaned === '' ? 'Array sheet' : cleaned;
}

export function suggestedImageName(show: string, array: string): string {
  return `${safeName(show.replace(/\.xmlp$/i, ''))} - ${safeName(array)}.png`;
}

export function suggestedPdfName(title: string, revision: string): string {
  const base = safeName(title.replace(/\.xmlp$/i, ''));
  return `${base}${revision ? ` - Rev ${revision}` : ''}.pdf`;
}

export function suggestedFileName(title: string, revision: string): string {
  const base = safeName(title.replace(/\.xmlp$/i, ''));
  return `${base}${revision ? ` - Rev ${revision}` : ''}${FILE_SUFFIX}`;
}
