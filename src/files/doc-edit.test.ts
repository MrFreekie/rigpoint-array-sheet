import { describe, expect, it } from 'vitest';
import type { Problem } from '../engine/types';
import { parseFixture } from '../testing/fixtures';
import {
  deletedList,
  displayName,
  editKey,
  isDeleted,
  liveIndexes,
  newDoc,
  updatedDoc,
  visibleProblems,
  withDeleted,
  withNote,
  withPrinted,
  withTitle,
  type Doc,
} from './doc';

const fresh = (): Doc => newDoc(parseFixture('a'), 'a.pdf');

describe('deleting an array', () => {
  it('marks it deleted and keeps the data of the report', () => {
    const doc = fresh();
    const count = doc.result.report.sources.length;
    const gone = withDeleted(doc, 3, true);
    expect(isDeleted(gone, 3)).toBe(true);
    expect(deletedList(gone)).toEqual([3]);
    expect(gone.result.report.sources).toHaveLength(count);
    expect(liveIndexes(gone)).toHaveLength(count - 1);
    expect(liveIndexes(gone)).not.toContain(3);
  });

  it('can be undone', () => {
    const back = withDeleted(withDeleted(fresh(), 3, true), 3, false);
    expect(isDeleted(back, 3)).toBe(false);
    expect(deletedList(back)).toEqual([]);
  });

  it('changes what counts as unsaved, and changing back puts it right again', () => {
    const doc = fresh();
    const key = editKey(doc);
    const gone = withDeleted(doc, 3, true);
    expect(editKey(gone)).not.toBe(key);
    expect(editKey(withDeleted(gone, 3, false))).toBe(key);
  });

  it('is refused on a read-only file', () => {
    const doc = { ...fresh(), locked: true };
    expect(withDeleted(doc, 3, true)).toBe(doc);
  });
});

describe('titles and notes', () => {
  it('show the title typed, else the name in the report', () => {
    const doc = fresh();
    const name = doc.result.report.sources[0]!.name;
    expect(displayName(doc, 0)).toBe(name);
    const titled = withTitle(doc, 0, '  Front left  ');
    expect(displayName(titled, 0)).toBe('Front left');
    expect(displayName(withTitle(titled, 0, '   '), 0)).toBe(name);
  });

  it('change what counts as unsaved, but a blank one does not', () => {
    const doc = fresh();
    const key = editKey(doc);
    expect(editKey(withTitle(doc, 0, 'Front left'))).not.toBe(key);
    expect(editKey(withNote(doc, 0, 'Rig first'))).not.toBe(key);
    expect(editKey(withTitle(withNote(doc, 0, '  '), 0, ''))).toBe(key);
  });

  it('are refused on a read-only file', () => {
    const doc = { ...fresh(), locked: true };
    expect(withTitle(doc, 0, 'x')).toBe(doc);
    expect(withNote(doc, 0, 'x')).toBe(doc);
  });
});

describe('updatedDoc', () => {
  it('keeps offsets, print choices, titles and notes with the array of the same name', () => {
    let doc = fresh();
    doc.offsets = { 2: '0.5' };
    doc = withTitle(withNote(withPrinted(doc, 2, false), 2, 'Check the motor'), 2, 'Centre');
    const next = parseFixture('a');
    const out = updatedDoc(doc, next, 'new.pdf');
    expect(out.sourceName).toBe('new.pdf');
    expect(out.result).toBe(next);
    expect(out.offsets).toEqual({ 2: '0.5' });
    expect(out.noPrint).toEqual({ 2: true });
    expect(out.titles).toEqual({ 2: 'Centre' });
    expect(out.notes).toEqual({ 2: 'Check the motor' });
  });

  it('keeps the job details, including the show notes and the show date', () => {
    const doc = fresh();
    doc.job = { ...doc.job, show: 'Main stage', notes: 'Call Sam first.', showDate: '2026-10-23' };
    const out = updatedDoc(doc, parseFixture('a'), 'new.pdf');
    expect(out.job).toEqual({ ...doc.job });
  });

  it('brings a deleted array back when the new PDF has it, with its title and note', () => {
    const doc = withTitle(withDeleted(fresh(), 3, true), 3, 'Delay fill');
    const out = updatedDoc(doc, parseFixture('a'), 'new.pdf');
    expect(deletedList(out)).toEqual([]);
    expect(isDeleted(out, 3)).toBe(false);
    expect(out.titles).toEqual({ 3: 'Delay fill' });
  });

  it('drops what belonged to an array that is not in the new PDF', () => {
    const doc = withTitle(withDeleted(fresh(), 3, true), 3, 'Delay fill');
    const out = updatedDoc(doc, parseFixture('b'), 'b.pdf');
    expect(out.deleted).toEqual({});
    expect(out.titles).toEqual({});
  });
});

describe('visibleProblems', () => {
  const check = (source: string | null): Problem => ({ level: 'check', source, message: 'look at this' });
  const withProblems = (problems: Problem[]): Doc => {
    const doc = fresh();
    return { ...doc, result: { ...doc.result, problems } };
  };
  const name = (i: number) => fresh().result.report.sources[i]!.name;

  it('hides a check that concerns only a deleted array', () => {
    const doc = withDeleted(withProblems([check(name(3)), check(name(4)), check(null)]), 3, true);
    expect(visibleProblems(doc).map((p) => p.source)).toEqual([name(4), null]);
  });

  it('never hides an error', () => {
    const error: Problem = { level: 'error', source: name(3), message: 'cannot be read' };
    const doc = withDeleted(withProblems([error]), 3, true);
    expect(visibleProblems(doc)).toEqual([error]);
  });

  it('keeps a check while another array of the same name is left', () => {
    const base = withProblems([check(name(3))]);
    const twin = { ...base.result.report.sources[3]!, name: name(3) };
    const doc = { ...base, result: { ...base.result, report: { ...base.result.report, sources: [...base.result.report.sources, twin] } } };
    expect(visibleProblems(withDeleted(doc, 3, true))).toHaveLength(1);
  });
});
