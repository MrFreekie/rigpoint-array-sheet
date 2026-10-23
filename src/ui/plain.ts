/** Text without control characters, which the file refuses. Line breaks stay when `keepBreaks` is set. */
export function plain(text: string, keepBreaks: boolean): string {
  const lines = text.replace(/\r\n?/g, '\n');
  return [...lines].filter((c) => (c === '\n' && keepBreaks) || (c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)).join('');
}
