// Each saved-file version has a step that upgrades it to the next. A file from a newer version of
// the app is refused, because it may hold things this version would silently lose.

import { defaultCartSizes } from '../engine/carts';
import { defaultSymbolValues } from '../engine/markers';
import { FORMAT_NAME, FORMAT_VERSION } from '../schema/array-file';

export class FileError extends Error {}

export type Migration = (file: Record<string, unknown>) => Record<string, unknown>;

/** Key is the version a step upgrades from. */
export const MIGRATIONS: Record<number, Migration> = {
  // Version 2 added the choice of which arrays to print. A version 1 file printed them all.
  1: (file) => {
    const report = file['report'];
    const sources = typeof report === 'object' && report !== null ? (report as { sources?: unknown }).sources : undefined;
    return { ...file, print: Array.isArray(sources) ? sources.map(() => true) : [] };
  },
  // Version 3 added the venue. Earlier files had none.
  2: (file) => {
    const job = file['job'];
    return typeof job === 'object' && job !== null && !Array.isArray(job) ? { ...file, job: { ...job, venue: '' } } : file;
  },
  // Version 4 added the optional column of an enclosure row (ground stacks laid out in columns).
  // Nothing in an older file changes; the step makes older copies of the app refuse every version 4 file, with or without columns.
  3: (file) => file,
  // Version 5 added the optional fixation positions of a stacked array. Nothing in an older file changes; the step makes
  // older copies of the app refuse every version 5 file, so they cannot open one with fixations and drop them.
  4: (file) => file,
  // Version 6 added the origin note (P0) and the side labels choice for the rigging plot. Earlier files had a blank note
  // and showed the side labels. An older copy of the app would
  // drop the note when it saved, so it refuses version 6 files.
  5: (file) => {
    const job = file['job'];
    return typeof job === 'object' && job !== null && !Array.isArray(job) ? { ...file, job: { ...job, origin: '', side_labels: true } } : file;
  },
  // Version 7 added a card title and a note for each array, the arrays the person deleted, and the notes and date of the show.
  // An older copy of the app would drop them when it saved, and bring deleted arrays back, so it refuses version 7 files.
  6: (file) => {
    const report = file['report'];
    const sources = typeof report === 'object' && report !== null ? (report as { sources?: unknown }).sources : undefined;
    const count = Array.isArray(sources) ? sources.length : 0;
    const job = file['job'];
    return {
      ...file,
      ...(typeof job === 'object' && job !== null && !Array.isArray(job) ? { job: { ...job, notes: '', show_date: '' } } : {}),
      titles: Array.from({ length: count }, () => ''),
      notes: Array.from({ length: count }, () => ''),
      deleted: Array.from({ length: count }, () => false),
    };
  },
  // Version 8 added the plot symbol of each pickup. Earlier files had the 1 ton symbol everywhere. An older copy of the app
  // would drop the choices when it saved, so it refuses version 8 files.
  7: (file) => {
    const report = file['report'];
    const sources = typeof report === 'object' && report !== null ? (report as { sources?: unknown }).sources : undefined;
    const count = Array.isArray(sources) ? sources.length : 0;
    return { ...file, markers: Array.from({ length: count }, () => ({ front: { shape: 'one', text: '' }, rear: { shape: 'one', text: '' } })) };
  },
  // Version 9 added the venue underlay of the rigging plot. Earlier files had none. An older copy of the app would drop it
  // when it saved, so it refuses version 9 files.
  8: (file) => ({ ...file, underlay: null }),
  // Version 10 added the cable patch: a feeder and a way for each enclosure row of each array. Earlier files had none, so
  // every row starts blank. An older copy of the app would drop the patch when it saved, so it refuses version 10 files.
  9: (file) => {
    const report = file['report'];
    const sources = typeof report === 'object' && report !== null ? (report as { sources?: unknown }).sources : undefined;
    const rows = (source: unknown): number => {
      const cabinets = typeof source === 'object' && source !== null ? (source as { cabinets?: unknown }).cabinets : undefined;
      return Array.isArray(cabinets) ? cabinets.length : 0;
    };
    return { ...file, patch: Array.isArray(sources) ? sources.map((s) => Array.from({ length: rows(s) }, () => ({ feeder: '', way: '' }))) : [] };
  },
  // Version 11 added carts: the groups of enclosures an array is built from, cut from a size for each type of enclosure, or by
  // hand. Earlier files start with the usual sizes and every array automatic. An older copy of the app would drop the sizes and
  // any hand cut carts when it saved, so it refuses version 11 files.
  10: (file) => {
    const report = file['report'];
    const sources = typeof report === 'object' && report !== null ? (report as { sources?: unknown }).sources : undefined;
    return {
      ...file,
      cart_sizes: defaultCartSizes(),
      carts: Array.isArray(sources) ? sources.map(() => ({ manual: false, breaks: [] })) : [],
    };
  },
  // Version 12 added the optional row of an enclosure row (ground stacks laid out in rows, "R2 #1"). Nothing in an older file
  // changes; the step makes older copies of the app refuse every version 12 file, so they cannot open one with rows and drop them.
  11: (file) => file,
  // Version 13 added the choice of which arrays are on the rigging plot, and whether the plot prints. Earlier files had every
  // array on the plot and printed it. An older copy of the app would drop the choices when it saved, so it refuses version 13 files.
  12: (file) => {
    const report = file['report'];
    const sources = typeof report === 'object' && report !== null ? (report as { sources?: unknown }).sources : undefined;
    return { ...file, plot: Array.isArray(sources) ? sources.map(() => true) : [], print_plot: true };
  },
  // Version 14 moved the value written for each plot symbol (such as "1 t") to Settings, one value for each of the four shapes
  // for the whole job. Earlier files could type a value on a single pickup: that text is dropped and every symbol starts with
  // its usual value. An older copy of the app would drop the values when it saved, so it refuses version 14 files.
  13: (file) => {
    const markers = file['markers'];
    const shapeOf = (side: unknown): { shape: unknown } => ({ shape: typeof side === 'object' && side !== null ? (side as { shape?: unknown }).shape : undefined });
    return {
      ...file,
      ...(Array.isArray(markers)
        ? {
            markers: markers.map((pair) => {
              const p = typeof pair === 'object' && pair !== null ? (pair as { front?: unknown; rear?: unknown }) : {};
              return { front: shapeOf(p.front), rear: shapeOf(p.rear) };
            }),
          }
        : {}),
      symbol_values: defaultSymbolValues(),
    };
  },
  // Version 15 added the choices to show the Position dots and the array outlines on the rigging plot. Earlier files showed both.
  // An older copy of the app would drop the choices when it saved, so it refuses version 15 files.
  14: (file) => ({ ...file, show_position: true, show_outlines: true }),
};

export function migrate(
  raw: unknown,
  current = FORMAT_VERSION,
  steps: Record<number, Migration> = MIGRATIONS,
): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new FileError('This is not a RigPoint Array Sheet file.');
  }
  let file = raw as Record<string, unknown>;
  const m = /^arraysheet\/(\d+)$/.exec(typeof file['format'] === 'string' ? file['format'] : '');
  if (!m) throw new FileError(`This is not a RigPoint Array Sheet file. It does not say its format is "${FORMAT_NAME}/${current}".`);
  let version = Number(m[1]);
  if (version > current) {
    throw new FileError('This file was saved by a newer version of RigPoint Array Sheet. Reload the app to update it, then open the file again.');
  }
  while (version < current) {
    const step = steps[version];
    if (!step) throw new FileError(`This file is version ${version} and cannot be upgraded.`);
    file = step(file);
    version++;
    file['format'] = `${FORMAT_NAME}/${version}`;
  }
  return file;
}
