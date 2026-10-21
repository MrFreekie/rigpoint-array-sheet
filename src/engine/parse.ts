// Reads the text of a Soundvision report and returns the array information it states.
// Pure: text in, data out. It copies what the PDF prints and calculates nothing.
// Anything it cannot read is reported as a problem rather than guessed.

import * as msg from './messages';
import type {
  ArraySource,
  Cabinet,
  ParseResult,
  Pickup,
  Point3,
  Problem,
  ReportDocument,
  SoundvisionWarning,
  TextItem,
} from './types';

interface Cell {
  x: number;
  text: string;
}

export interface Line {
  page: number;
  y: number;
  cells: Cell[];
  text: string;
}

/** Items closer than this (in points) vertically are on the same line. */
const SAME_LINE = 2.5;
/** A value may start this far left of its column heading and still belong to the column. */
const COLUMN_SLACK = 6;
/** Soundvision rounds each figure to the nearest 0.1° or 0.01 m, so allow for that. */
const SITE_TOLERANCE = 0.15;

export function toLines(items: readonly TextItem[]): Line[] {
  const byPage = new Map<number, TextItem[]>();
  for (const item of items) {
    if (item.text.trim() === '') continue;
    const list = byPage.get(item.page);
    if (list) list.push(item);
    else byPage.set(item.page, [item]);
  }
  const lines: Line[] = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const pageItems = [...(byPage.get(page) ?? [])].sort((a, b) => b.y - a.y || a.x - b.x);
    let current: TextItem[] = [];
    let top = 0;
    const flush = () => {
      if (current.length === 0) return;
      const cells = current
        .sort((a, b) => a.x - b.x)
        .map((i) => ({ x: i.x, text: i.text.trim() }));
      lines.push({ page, y: top, cells, text: cells.map((c) => c.text).join(' ') });
      current = [];
    };
    for (const item of pageItems) {
      if (current.length > 0 && top - item.y > SAME_LINE) flush();
      if (current.length === 0) top = item.y;
      current.push(item);
    }
    flush();
  }
  return lines;
}

const NUMBER = /^-?\d+(?:\.\d+)?$/;

function num(text: string): number | null {
  const t = text.replace(/−/g, '-').trim();
  return NUMBER.test(t) ? Number(t) : null;
}

const FOOTER = /^Page \d+ of \d+$/;
const GROUP = /^(\d+)\. Group: (.+)$/;
const SOURCE = /^(\d+)\. Source: (.+)$/;
const PHYSICAL = /^\d+\. 1\. Physical configuration$/;
const ACOUSTIC = /^\d+\. 2\. Acoustic configuration$/;
const SEVERITY = /^[A-Z]{4,}$/;
const POINT = '(-?[\\d.]+); (-?[\\d.]+); (-?[\\d.]+)';
const DEGREES = '(-?[\\d.]+) \\S+';

function point(m: RegExpMatchArray, from: number): Point3 | null {
  const x = num(m[from] ?? '');
  const y = num(m[from + 1] ?? '');
  const z = num(m[from + 2] ?? '');
  return x === null || y === null || z === null ? null : { x, y, z };
}

type Column = 'angle' | 'site' | 'topZ' | 'bottomZ' | 'panflex';

interface TableLayout {
  /** Where the first numeric column starts: anything to the left is the enclosure type. */
  typeEnds: number;
  columns: { key: Column | null; start: number }[];
}

const COLUMN_HEADINGS: [RegExp, Column][] = [
  [/^Angles?\b/, 'angle'],
  [/^Site\b/, 'site'],
  [/^Top Z\b/, 'topZ'],
  [/^Bottom Z\b/, 'bottomZ'],
  [/^Panflex\b/, 'panflex'],
];

function isTableHeader(line: Line): boolean {
  return line.cells[0]?.text === '#' && line.cells.some((c) => c.text === 'Type');
}

function layoutOf(line: Line): TableLayout {
  const columns: TableLayout['columns'] = [];
  for (const cell of line.cells) {
    if (cell.text === '#' || cell.text === 'Type') continue;
    const found = COLUMN_HEADINGS.find(([re]) => re.test(cell.text));
    columns.push({ key: found ? found[1] : null, start: cell.x - COLUMN_SLACK });
  }
  columns.sort((a, b) => a.start - b.start);
  return { typeEnds: columns[0]?.start ?? Infinity, columns };
}

function blankWeights(): ArraySource['weights'] {
  return { total: null, enclosures: null, frontMotorLoad: null, rearMotorLoad: null };
}

function newSource(number: number, name: string, groups: string[]): ArraySource {
  return {
    number,
    name,
    groups,
    configuration: null,
    orientation: null,
    mounting: null,
    bumper: null,
    motors: null,
    pickups: [],
    position: null,
    site: null,
    azimuth: null,
    dimensions: null,
    bottomElevation: null,
    topSite: null,
    bottomSite: null,
    weights: blankWeights(),
    cabinets: [],
    warnings: [],
  };
}

type Section = 'document' | 'groups' | 'source' | 'physical' | 'acoustic';

export function parseSoundvision(items: readonly TextItem[]): ParseResult {
  const problems: Problem[] = [];
  const document: ReportDocument = {
    version: null,
    author: null,
    date: null,
    fileName: null,
    distanceUnit: null,
    weightUnit: null,
  };
  const sources: ArraySource[] = [];
  const lines = toLines(items);

  if (lines.length === 0) {
    problems.push({ level: 'error', source: null, message: msg.NO_TEXT });
    return { report: { document, sources }, problems, ok: false };
  }

  let section: Section = 'document';
  let source: ArraySource | null = null;
  let layout: TableLayout | null = null;
  let inWarnings = false;
  let warning: SoundvisionWarning | null = null;
  const groupStack: { n: number; name: string }[] = [];

  const problem = (level: Problem['level'], message: string) =>
    problems.push({ level, source: source?.name ?? null, message });

  function setGroup(n: number, name: string, text: string) {
    if (n > 1) {
      while (groupStack.length > 0 && groupStack[groupStack.length - 1]?.n !== n - 1) groupStack.pop();
      if (groupStack.length === 0) {
        problems.push({ level: 'check', source: null, message: msg.groupNumbering(text) });
      } else {
        groupStack.pop();
      }
    }
    groupStack.push({ n, name });
  }

  function documentLine(line: Line) {
    const t = line.text;
    const keyed = (re: RegExp): string | null => re.exec(t)?.[1]?.trim() ?? null;
    document.version ??= keyed(/^Version:\s*(.+)$/);
    document.author ??= keyed(/^Author:\s*(.+)$/);
    document.date ??= keyed(/^Date:\s*(.+)$/);
    document.fileName ??= keyed(/^File name:\s*(.+)$/);
    document.distanceUnit ??= keyed(/^Distance unit:\s*(\S+)$/);
    document.weightUnit ??= keyed(/^Weight unit:\s*(\S+)$/);
  }

  function weight(m: RegExpMatchArray, field: keyof ArraySource['weights']) {
    const value = num(m[1] ?? '');
    if (source && value !== null) source.weights[field] = value;
  }

  function physicalField(line: Line, src: ArraySource): boolean {
    const t = line.text;
    let m: RegExpMatchArray | null;

    if ((m = t.match(/^Configuration:\s*(.+)$/))) {
      const text = m[1] ?? '';
      src.configuration = text;
      src.orientation = /\bvertical\b/i.test(text) ? 'vertical' : /\bhorizontal\b/i.test(text) ? 'horizontal' : null;
      src.mounting = /\bflown\b/i.test(text) ? 'flown' : /\bstacked\b/i.test(text) ? 'stacked' : null;
    } else if ((m = t.match(/^Bumper:\s*(.+)$/))) {
      src.bumper = m[1] ?? null;
    } else if ((m = t.match(/^# motors:\s*(\d+)$/))) {
      src.motors = Number(m[1]);
    } else if ((m = t.match(new RegExp(`^(Front|Rear) pickup position \\(X; Y; Z, m\\):\\s*(\\d+) \\(${POINT}\\)$`)))) {
      const at = point(m, 3);
      const position = num(m[2] ?? '');
      if (at && position !== null) {
        const pickup: Pickup = { which: m[1] === 'Front' ? 'front' : 'rear', position, at };
        src.pickups.push(pickup);
      } else return false;
    } else if ((m = t.match(new RegExp(`^Position \\(X; Y; Z, m\\):\\s*${POINT}$`)))) {
      src.position = point(m, 1);
    } else if ((m = t.match(new RegExp(`^Spatial dimensions \\(X; Y; Z, m\\):\\s*${POINT}$`)))) {
      src.dimensions = point(m, 1);
    } else if ((m = t.match(new RegExp(`^Site:\\s*${DEGREES}$`)))) {
      src.site = num(m[1] ?? '');
    } else if ((m = t.match(new RegExp(`^Azimuth:\\s*${DEGREES}$`)))) {
      src.azimuth = num(m[1] ?? '');
    } else if ((m = t.match(new RegExp(`^Top site:\\s*${DEGREES}$`)))) {
      src.topSite = num(m[1] ?? '');
    } else if ((m = t.match(new RegExp(`^Bottom site:\\s*${DEGREES}$`)))) {
      src.bottomSite = num(m[1] ?? '');
    } else if ((m = t.match(/^Bottom elevation:\s*(-?[\d.]+) m$/))) {
      src.bottomElevation = num(m[1] ?? '');
    } else if ((m = t.match(/^Total weight \(Enclosures \+ Frames\):\s*(-?[\d.]+) kg$/))) {
      weight(m, 'total');
    } else if ((m = t.match(/^Total enclosure weight:\s*(-?[\d.]+) kg$/))) {
      weight(m, 'enclosures');
    } else if ((m = t.match(/^Front motor load:\s*(-?[\d.]+) kg$/))) {
      weight(m, 'frontMotorLoad');
    } else if ((m = t.match(/^Rear motor load:\s*(-?[\d.]+) kg$/))) {
      weight(m, 'rearMotorLoad');
    } else {
      return false;
    }
    return true;
  }

  function tableRow(line: Line, src: ArraySource, table: TableLayout) {
    const first = line.cells[0];
    const number = Number(/^#(\d+)$/.exec(first?.text ?? '')?.[1]);
    const typeParts: string[] = [];
    const values: Partial<Record<Column, string[]>> = {};
    for (const cell of line.cells.slice(1)) {
      if (cell.x < table.typeEnds) {
        typeParts.push(cell.text);
        continue;
      }
      let column = null;
      for (const c of table.columns) if (c.start <= cell.x) column = c;
      if (column?.key) (values[column.key] ??= []).push(cell.text);
    }

    const read = (key: Column, label: string, required: boolean): number | null => {
      const parts = values[key];
      if (!parts || parts.length === 0) {
        if (required) problem('check', msg.missingCell(number, label));
        return null;
      }
      const value = parts.length === 1 ? num(parts[0] ?? '') : null;
      if (value === null) problem('check', msg.unreadableCell(number, label, parts.join(' ')));
      return value;
    };

    const hasAngles = table.columns.some((c) => c.key === 'angle');
    const site = read('site', 'site angle', true);
    const cabinet: Cabinet = {
      number,
      type: typeParts.join(' '),
      angle: hasAngles ? read('angle', 'angle', false) : null,
      site,
      topZ: read('topZ', 'top height', true),
      bottomZ: read('bottomZ', 'bottom height', true),
      panflex: values.panflex?.join(' ') ?? null,
    };
    src.cabinets.push(cabinet);
  }

  function warningLine(line: Line, src: ArraySource) {
    if (SEVERITY.test(line.text)) {
      warning = { severity: line.text, title: '', message: '' };
      src.warnings.push(warning);
    } else if (warning) {
      if (warning.title === '') warning.title = line.text;
      else warning.message = warning.message === '' ? line.text : `${warning.message} ${line.text}`;
    } else {
      problem('check', msg.warningWithoutSeverity(line.text));
    }
  }

  for (const line of lines) {
    if (FOOTER.test(line.text)) continue;
    let m: RegExpMatchArray | null;

    if ((m = line.text.match(GROUP))) {
      finishSource();
      setGroup(Number(m[1]), m[2] ?? '', line.text);
      section = 'groups';
      continue;
    }
    if ((m = line.text.match(SOURCE))) {
      finishSource();
      source = newSource(Number(m[1]), m[2] ?? '', groupStack.map((g) => g.name));
      sources.push(source);
      section = 'source';
      continue;
    }
    if (PHYSICAL.test(line.text) && source) {
      section = 'physical';
      layout = null;
      inWarnings = false;
      warning = null;
      continue;
    }
    if (ACOUSTIC.test(line.text) && source) {
      section = 'acoustic';
      continue;
    }

    if (section === 'document') {
      documentLine(line);
    } else if (section === 'physical' && source) {
      if (isTableHeader(line)) {
        layout = layoutOf(line);
        inWarnings = false;
      } else if (layout && /^#\d+$/.test(line.cells[0]?.text ?? '')) {
        tableRow(line, source, layout);
      } else if (line.text === 'Mechanical warnings:') {
        inWarnings = true;
        warning = null;
      } else if (inWarnings && !physicalField(line, source)) {
        warningLine(line, source);
      } else if (!inWarnings && !physicalField(line, source)) {
        problem('check', msg.notUnderstood(line.text));
      }
    }
    // Group settings, source headings and the acoustic configuration are not array information.
  }
  finishSource();

  if (document.weightUnit === null) problems.push({ level: 'error', source: null, message: msg.missingUnit('weight unit') });
  else if (document.weightUnit !== 'kg')
    problems.push({ level: 'error', source: null, message: msg.unitProblem('The weight unit', document.weightUnit, 'kg') });
  if (document.distanceUnit === null) problems.push({ level: 'error', source: null, message: msg.missingUnit('distance unit') });
  else if (document.distanceUnit !== 'm')
    problems.push({ level: 'error', source: null, message: msg.unitProblem('The distance unit', document.distanceUnit, 'metres') });
  if (sources.length === 0) problems.push({ level: 'error', source: null, message: msg.NOT_A_REPORT });

  function finishSource() {
    if (!source) return;
    const s = source;
    const note = (level: Problem['level'], message: string) => problems.push({ level, source: s.name, message });
    layout = null;

    if (s.configuration === null) note('check', msg.missingField('"Configuration"'));
    if (s.weights.total === null) note('check', msg.missingField('"Total weight (Enclosures + Frames)"'));
    if (s.site === null) note('check', msg.missingField('"Site"'));
    if (s.cabinets.length === 0) {
      note('check', msg.noEnclosureTable());
    } else {
      checkTable(s, note);
    }
    if (s.motors !== null && s.pickups.length !== s.motors) note('check', msg.pickupCount(s.motors, s.pickups.length));
    source = null;
  }

  return { report: { document, sources }, problems, ok: !problems.some((p) => p.level === 'error') };
}

/**
 * Cross-checks that a flown table was read correctly, using figures the PDF prints. In a flown array
 * each row's site angle is the one above minus its angle, and the top and bottom site match the first
 * and last rows. Heights are not compared: with large splays the front edges of enclosures do not
 * meet, so a gap there is the design and not a reading error. Stacked arrays follow different rules
 * (mixed enclosures, tilted tops, HF stacks), so only their numbering is checked.
 */
function checkTable(s: ArraySource, note: (level: Problem['level'], message: string) => void) {
  const numbers = s.cabinets.map((c) => c.number);
  const ascending = numbers.every((n, i) => n === i + 1);
  const descending = numbers.every((n, i) => n === numbers.length - i);
  if (!ascending && !descending) note('check', msg.enclosureNumbering(numbers.map((n) => `#${n}`).join(', ')));

  if (s.mounting !== 'flown') return;
  const first = s.cabinets[0];
  const last = s.cabinets[s.cabinets.length - 1];
  if (first?.site != null && s.topSite !== null && Math.abs(first.site - s.topSite) > SITE_TOLERANCE) note('check', msg.topSiteMismatch());
  if (last?.site != null && s.bottomSite !== null && Math.abs(last.site - s.bottomSite) > SITE_TOLERANCE) note('check', msg.bottomSiteMismatch());

  for (let i = 1; i < s.cabinets.length; i++) {
    const above = s.cabinets[i - 1];
    const here = s.cabinets[i];
    if (!above || !here) continue;
    if (here.angle !== null && above.site !== null && here.site !== null && Math.abs(above.site - here.angle - here.site) > SITE_TOLERANCE) {
      note('check', msg.siteDoesNotFollow(here.number));
    }
  }
}
