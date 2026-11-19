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
  /** The slot the pickup fills. A pickup the report names left is the front one and a pickup it names right is the rear one. */
  which: 'front' | 'rear';
  /** Set when the report names the pickup left or right, e.g. "Front left pickup position". Absent for a pickup named front or rear. */
  side?: 'left' | 'right' | undefined;
  /** The pickup position number as printed, e.g. 6 in "Front pickup position: 6 (10; 12.68; 9.51)", or its code, e.g. EXT, when it is not a number. */
  position: number | string;
  at: Point3;
}

export type PickupWord = 'front' | 'rear' | 'left' | 'right';

/** How a pickup is named: left or right when the report says so, else front or rear. */
export function pickupWord(p: { which: 'front' | 'rear'; side?: 'left' | 'right' | undefined }): PickupWord {
  return p.side ?? p.which;
}

/** The same word as it starts a label: Front, Rear, Left or Right. */
export function pickupName(p: { which: 'front' | 'rear'; side?: 'left' | 'right' | undefined }): Capitalize<PickupWord> {
  const w = pickupWord(p);
  return `${w.charAt(0).toUpperCase()}${w.slice(1)}` as Capitalize<PickupWord>;
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
  /** The row of a ground stack that is laid out in rows: "R2 #1" is 2. Absent when the row has no stack row. */
  row?: number | undefined;
  type: string;
  /** Angle column as printed on this enclosure's row. Null when the table has no Angles column. */
  angle: number | null;
  site: number | null;
  topZ: number | null;
  bottomZ: number | null;
  /** Panflex setting as printed, e.g. "35/35". Null when the table has no Panflex value for this row. */
  panflex: string | null;
}

/** How a row's number is printed: "3", "C2 #1" when the array is laid out in columns, or "R2 #1" when it is laid out in rows. */
export function enclosureLabel(c: { number: number; column?: number | null | undefined; row?: number | null | undefined }): string {
  if (c.column) return `C${c.column} #${c.number}`;
  if (c.row) return `R${c.row} #${c.number}`;
  return String(c.number);
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

/** The delay and gain a Soundvision group states for the sources in it. Each is the number as printed, or null when not stated. */
export interface GroupTuning {
  group: string;
  delay: string | null;
  gain: string | null;
}

/**
 * What the acoustic configuration of a source states before its first enclosure, copied as printed (numbers as text, so
 * "4.17" stays "4.17"). Null for anything the report does not state or prints in a form this app does not read.
 * The FIR and air compensation lines after the first enclosure are not read.
 */
export interface ArrayTuning {
  /** The whole "Autofilter ..." line. */
  autofilter: string | null;
  /** The frequency in Hz of "LF Contour: Frequency = X Hz; Gain = Y dB". */
  lfContourFrequency: string | null;
  /** The gain in dB of the LF Contour line. */
  lfContourGain: string | null;
  /** "Zoom Factor (ratio): X". */
  zoom: string | null;
  /** The source's own delay in ms. */
  delay: string | null;
  /** The source's own gain in dB. */
  gain: string | null;
  /** The groups the source sits in that state a delay or a gain, outermost first. */
  groups: GroupTuning[];
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
  /** The tuning the report states. Absent in a file saved before the app read it. */
  tuning?: ArrayTuning | undefined;
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
