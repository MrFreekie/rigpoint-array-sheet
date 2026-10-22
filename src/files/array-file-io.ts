// Turning a document into a saved file and back. Opening is strict: the text is untrusted until
// it has passed the size limit, the format check, any upgrade steps and the schema.

import { ArrayFileSchema, FORMAT, type ArrayFile } from '../schema/array-file';
import { formatIssues } from '../schema/errors';
import { editKey, statusLocks, type Doc } from './doc';
import { MAX_FILE_BYTES } from './limits';
import { FileError, migrate } from './migrations';

export function docToFile(doc: Doc, appVersion: string, now: Date): ArrayFile {
  const count = doc.result.report.sources.length;
  return {
    format: FORMAT,
    app_version: appVersion,
    saved_at: now.toISOString(),
    status: doc.status,
    revision: doc.revision,
    source_name: doc.sourceName,
    job: {
      show: doc.job.show,
      engineer: doc.job.engineer,
      company: doc.job.company,
      z_axis_zero: doc.job.zAxisZero,
      default_offset: doc.job.defaultOffset,
    },
    offsets: Array.from({ length: count }, (_, i) => doc.offsets[i] ?? ''),
    print: Array.from({ length: count }, (_, i) => !doc.noPrint[i]),
    report: doc.result.report,
    problems: doc.result.problems,
  };
}

export function serialiseDoc(doc: Doc, appVersion: string, now: Date = new Date()): string {
  return `${JSON.stringify(docToFile(doc, appVersion, now), null, 2)}\n`;
}

export interface OpenedFile {
  doc: Doc;
  /** When the file was saved, as the file states. */
  savedAt: string;
}

/** @param fileName the name to show as the file this was opened from, or null when there is none. */
export function openFileText(text: string, fileName: string | null): OpenedFile {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) {
    throw new FileError(`This file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB, which is too big for a RigPoint Array file.`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new FileError('This file is not a RigPoint Array file. It could not be read as saved data.');
  }
  const upgraded = migrate(raw);
  const checked = ArrayFileSchema.safeParse(upgraded);
  if (!checked.success) {
    throw new FileError(`This file could not be opened. ${formatIssues(checked.error).join(' ')}`);
  }
  const f = checked.data;
  const offsets: Record<number, string> = {};
  f.offsets.forEach((t, i) => {
    if (t.trim() !== '') offsets[i] = t;
  });
  const noPrint: Record<number, boolean> = {};
  f.print.forEach((printed, i) => {
    if (!printed) noPrint[i] = true;
  });
  const doc: Doc = {
    result: { report: f.report, problems: f.problems, ok: !f.problems.some((p) => p.level === 'error') },
    sourceName: f.source_name,
    job: {
      show: f.job.show,
      engineer: f.job.engineer,
      company: f.job.company,
      zAxisZero: f.job.z_axis_zero,
      defaultOffset: f.job.default_offset,
    },
    offsets,
    status: f.status,
    revision: f.revision,
    fileName,
    savedKey: null,
    locked: statusLocks(f.status),
    noPrint,
    printOverride: null,
  };
  doc.savedKey = editKey(doc);
  return { doc, savedAt: f.saved_at };
}
