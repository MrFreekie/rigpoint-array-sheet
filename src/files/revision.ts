// Revision letters for issued documents: blank for the first issue, then A, B, ... Z, AA, AB, ...

export const REVISION_PATTERN = /^[A-Z]{0,2}$/;

export function nextRevision(revision: string): string {
  if (revision === '') return 'A';
  const chars = revision.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i] === 'Z') {
      chars[i] = 'A';
    } else {
      chars[i] = String.fromCharCode((chars[i] as string).charCodeAt(0) + 1);
      return chars.join('');
    }
  }
  return `A${chars.join('')}`;
}

/** What a person typed in the revision box: capitals only, at most two letters. */
export function cleanRevision(text: string): string {
  return text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
}
