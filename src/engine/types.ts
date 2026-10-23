// Types for what the engine reads from a Soundvision report and what it returns.
// Values are kept exactly as the PDF prints them: the engine reads and never calculates.

/** One piece of text from a PDF page. Origin is the bottom left of the page, in points. */
export interface TextItem {
  page: number;
  x: number;
  y: number;
  text: string;
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface Pickup {
  which: 'front' | 'rear';
  /** The pickup position number as printed, e.g. 6 in "Front pickup position: 6 (10; 12.68; 9.51)". */
  position: number;
  at: Point3;
}

export interface Fixation {
  /** The name as printed, e.g. "Fr" in "Front right fixation position (X; Y; Z, m): Fr (-2.84; 4.6; 1)". */
  name: string;
  at: Point3;
}

export interface Cabinet {
  /** The number in the first column, "#1" is 1. */
  number: number;
  /** The column of a ground stack that is laid out in columns: "C2 #1" is 2. Absent when the row has no column. */
  column?: number | undefined;
  type: string;
  /** Angle column as printed on this enclosure's row. Null when the table has no Angles column. */
  angle: number | null;
  site: number | null;
  topZ: number | null;
  bottomZ: number | null;
  /** Panflex setting as printed, e.g. "35/35". Null when the table has no Panflex value for this row. */
  panflex: string | null;
}

/** How a row's number is printed: "3", or "C2 #1" when the array is laid out in columns. */
export function enclosureLabel(c: { number: number; column?: number | null | undefined }): string {
  return c.column ? `C${c.column} #${c.number}` : String(c.number);
}

export interface SoundvisionWarning {
  /** As printed, e.g. WARNING or CAUTION. */
  severity: string;
  title: string;
  message: string;
}

export interface ArrayWeights {
  /** "Total weight (Enclosures + Frames)". */
  total: number | null;
  /** "Total enclosure weight". */
  enclosures: number | null;
  frontMotorLoad: number | null;
  rearMotorLoad: number | null;
}

export interface ArraySource {
  /** The number printed before "Source:". */
  number: number;
  name: string;
  /** Soundvision groups the source sits in, outermost first. */
  groups: string[];
  /** "Configuration:" as printed, e.g. "vertical, flown array". */
  configuration: string | null;
  orientation: 'vertical' | 'horizontal' | null;
  mounting: 'flown' | 'stacked' | null;
  bumper: string | null;
  motors: number | null;
  pickups: Pickup[];
  /** "# fixations:" as printed. Absent when the array has no such line. */
  fixationCount?: number | undefined;
  /** The fixation positions of a stacked array, as printed. Absent when the array has none. */
  fixations?: Fixation[] | undefined;
  position: Point3 | null;
  site: number | null;
  azimuth: number | null;
  dimensions: Point3 | null;
  bottomElevation: number | null;
  topSite: number | null;
  bottomSite: number | null;
  weights: ArrayWeights;
  cabinets: Cabinet[];
  warnings: SoundvisionWarning[];
}

export interface ReportDocument {
  version: string | null;
  author: string | null;
  date: string | null;
  fileName: string | null;
  distanceUnit: string | null;
  weightUnit: string | null;
}

export type ProblemLevel = 'error' | 'check';

export interface Problem {
  level: ProblemLevel;
  /** Name of the source it concerns, or null when it concerns the whole report. */
  source: string | null;
  message: string;
}

export interface Report {
  document: ReportDocument;
  sources: ArraySource[];
}

export interface ParseResult {
  report: Report;
  problems: Problem[];
  /** False when there is an error-level problem: do not rely on the figures. */
  ok: boolean;
}
