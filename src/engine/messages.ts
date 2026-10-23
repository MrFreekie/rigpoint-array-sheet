// Fixed wording for the problems the engine reports. Each says what to check in the PDF.

export const CHECK_PDF = 'Check this against the PDF.';

export const NO_TEXT =
  'No text could be read from this PDF. It may be a scan or a picture of a report. Export the report from Soundvision again.';

export const NOT_A_REPORT =
  'This does not look like a Soundvision report: no "Source:" sections were found.';

export function unitProblem(what: string, found: string, expected: string): string {
  return `${what} is "${found}" in this report. This app reads ${expected} only, so the figures cannot be relied on. Export the report from Soundvision in ${expected}.`;
}

export function missingUnit(what: string): string {
  return `The report does not say its ${what}. ${CHECK_PDF}`;
}

export function notUnderstood(line: string): string {
  return `A line was not understood and is not shown: "${line}". ${CHECK_PDF}`;
}

export function missingField(what: string): string {
  return `${what} was not found. ${CHECK_PDF}`;
}

export function noEnclosureTable(): string {
  return `No enclosure table was found. ${CHECK_PDF}`;
}

/** A row as the report prints it: "#3", or "C2 #1" in a stack laid out in columns. */
function rowName(row: number, stackColumn: number | undefined): string {
  return stackColumn === undefined ? `#${row}` : `C${stackColumn} #${row}`;
}

export function unreadableCell(row: number, stackColumn: number | undefined, column: string, text: string): string {
  return `Enclosure ${rowName(row, stackColumn)}, ${column}: could not read "${text}" as a number. ${CHECK_PDF}`;
}

export function missingColumn(column: string): string {
  return `The enclosure table has no "${column}" column. ${CHECK_PDF}`;
}

export function missingCell(row: number, stackColumn: number | undefined, column: string): string {
  return `Enclosure ${rowName(row, stackColumn)}, ${column}: nothing was found. ${CHECK_PDF}`;
}

export function enclosureNumbering(found: string): string {
  return `The enclosures are not numbered in order, #1, #2, #3… or from the top down (found ${found}). A row may have been missed. ${CHECK_PDF}`;
}

export function stackColumnNumbering(found: string): string {
  return `The columns of the stack are not numbered C1, C2, C3… with none missing (found ${found}). A column may have been missed. ${CHECK_PDF}`;
}

export function mixedColumnRows(): string {
  return `Some enclosure rows have a column (such as "C1 #1") and some do not. ${CHECK_PDF}`;
}

export function siteDoesNotFollow(row: number): string {
  return `Enclosure #${row}: its site angle does not equal the one above minus its angle, so the table may have been read wrongly, or the report itself is inconsistent. ${CHECK_PDF}`;
}

export function topSiteMismatch(): string {
  return `"Top site" does not match the site angle of enclosure #1. ${CHECK_PDF}`;
}

export function bottomSiteMismatch(): string {
  return `"Bottom site" does not match the site angle of the last enclosure. ${CHECK_PDF}`;
}

export function pickupCount(motors: number, found: number): string {
  return `The report says ${motors} motor${motors === 1 ? '' : 's'} but ${found} pickup position${found === 1 ? '' : 's'} ${found === 1 ? 'was' : 'were'} found. ${CHECK_PDF}`;
}

export function fixationCount(count: number, found: number): string {
  return `The report says ${count} fixation${count === 1 ? '' : 's'} but ${found} fixation position${found === 1 ? '' : 's'} ${found === 1 ? 'was' : 'were'} found. ${CHECK_PDF}`;
}

export function repeatedFixationLine(): string {
  return `The report lists the fixation count more than once for one array, so only the last count is used. ${CHECK_PDF}`;
}

export function repeatedFixationName(name: string): string {
  return `The same fixation name appears twice: "${name}". Both positions are kept. ${CHECK_PDF}`;
}

export function groupNumbering(line: string): string {
  return `The group numbering at "${line}" could not be followed, so group names may be wrong. ${CHECK_PDF}`;
}

export function warningWithoutSeverity(line: string): string {
  return `A line under "Mechanical warnings" had no WARNING or CAUTION heading: "${line}". ${CHECK_PDF}`;
}
