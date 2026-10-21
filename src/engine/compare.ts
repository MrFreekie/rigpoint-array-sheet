// Compares a saved report with a newer one read from a fresh PDF, so the person can see exactly what
// the new PDF changes before choosing to update. Reads and compares; it does not decide anything.

import type { ArraySource, Report } from './types';

export interface Change {
  kind: 'added' | 'removed' | 'changed';
  /** The array concerned, or null for a change to the report as a whole. */
  array: string | null;
  what: string;
  saved: string | null;
  now: string | null;
}

const show = (v: string | number | null): string => (v === null ? 'not stated' : String(v));
const point = (p: { x: number; y: number; z: number } | null) => (p ? `${p.x}, ${p.y}, ${p.z}` : null);

/** Every figure of an array as label and text, in the order they are listed. */
function facts(s: ArraySource): Map<string, string> {
  const m = new Map<string, string>();
  m.set('Groups', s.groups.length > 0 ? s.groups.join(' > ') : 'none');
  m.set('Configuration', show(s.configuration));
  m.set('Bumper', show(s.bumper));
  m.set('Motors', show(s.motors));
  m.set('Position X, Y, Z', show(point(s.position)));
  m.set('Site', show(s.site));
  m.set('Azimuth', show(s.azimuth));
  m.set('Dimensions X, Y, Z', show(point(s.dimensions)));
  m.set('Bottom elevation', show(s.bottomElevation));
  m.set('Top site', show(s.topSite));
  m.set('Bottom site', show(s.bottomSite));
  m.set('Total weight', show(s.weights.total));
  m.set('Enclosure weight', show(s.weights.enclosures));
  m.set('Front motor load', show(s.weights.frontMotorLoad));
  m.set('Rear motor load', show(s.weights.rearMotorLoad));
  for (const p of s.pickups) m.set(`${p.which === 'front' ? 'Front' : 'Rear'} pickup`, `${p.position} at ${point(p.at)}`);
  for (const c of s.cabinets) {
    m.set(
      `Enclosure #${c.number}`,
      `${c.type}, angle ${show(c.angle)}, site ${show(c.site)}, top ${show(c.topZ)}, bottom ${show(c.bottomZ)}, Panflex ${show(c.panflex)}`,
    );
  }
  s.warnings.forEach((w, i) => m.set(`Warning ${i + 1}`, `${w.severity}: ${w.title} ${w.message}`.trim()));
  return m;
}

function diffFacts(array: string, a: Map<string, string>, b: Map<string, string>, out: Change[]) {
  for (const [what, saved] of a) {
    const now = b.get(what);
    if (now === undefined) out.push({ kind: 'removed', array, what, saved, now: null });
    else if (now !== saved) out.push({ kind: 'changed', array, what, saved, now });
  }
  for (const [what, now] of b) {
    if (!a.has(what)) out.push({ kind: 'added', array, what, saved: null, now });
  }
}

/** Arrays are matched by name. Two arrays with the same name are matched in the order they appear. */
export function compareReports(saved: Report, next: Report): Change[] {
  const out: Change[] = [];

  const doc: [string, string | null, string | null][] = [
    ['Soundvision version', saved.document.version, next.document.version],
    ['Report date', saved.document.date, next.document.date],
    ['Project file name', saved.document.fileName, next.document.fileName],
  ];
  for (const [what, a, b] of doc) {
    if (a !== b) out.push({ kind: 'changed', array: null, what, saved: show(a), now: show(b) });
  }

  const queues = new Map<string, ArraySource[]>();
  for (const s of next.sources) queues.set(s.name, [...(queues.get(s.name) ?? []), s]);
  const matched = new Set<ArraySource>();
  for (const s of saved.sources) {
    const match = queues.get(s.name)?.shift();
    if (!match) {
      out.push({ kind: 'removed', array: s.name, what: 'Array', saved: 'in the saved file', now: null });
      continue;
    }
    matched.add(match);
    diffFacts(s.name, facts(s), facts(match), out);
  }
  for (const s of next.sources) {
    if (!matched.has(s)) out.push({ kind: 'added', array: s.name, what: 'Array', saved: null, now: 'in the new PDF' });
  }
  return out;
}

/**
 * Where each array of the saved report sits in the new one, by position, matched by name in the same
 * way as the comparison. A saved array with no match maps to nothing.
 */
export function matchByName(saved: Report, next: Report): Map<number, number> {
  const queues = new Map<string, number[]>();
  next.sources.forEach((s, i) => queues.set(s.name, [...(queues.get(s.name) ?? []), i]));
  const map = new Map<number, number>();
  saved.sources.forEach((s, i) => {
    const j = queues.get(s.name)?.shift();
    if (j !== undefined) map.set(i, j);
  });
  return map;
}
