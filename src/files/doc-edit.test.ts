import { describe, expect, it } from 'vitest';
import type { Problem } from '../engine/types';
import { parseFixture } from '../testing/fixtures';
import { sheetModel } from '../ui/sheet-model';
import {
  deletedList,
  displayName,
  editKey,
  isDeleted,
  isOnPlot,
  liveIndexes,
  markerOf,
  newDoc,
  plotPrintChosen,
  symbolValueOf,
  updatedDoc,
  visibleProblems,
  withDeleted,
  withMarker,
  withNote,
  withOnPlot,
  plotShown,
  withPlotPrinted,
  withPlotShow,
  withPrinted,
  withSymbolValue,
  withSymbolValuesReset,
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

describe('the rigging plot choices', () => {
  const model = (d: Doc, mirrors = false) => sheetModel(d, mirrors);

  it('start with every array on the plot and the plot printed', () => {
    const doc = fresh();
    expect(isOnPlot(doc, 0)).toBe(true);
    expect(plotPrintChosen(doc)).toBe(true);
    expect(model(doc).hasPlot).toBe(true);
    expect(model(doc).printsPlot).toBe(true);
  });

  it('take an array off the plot and put it back, and count as an edit', () => {
    const doc = fresh();
    const off = withOnPlot(doc, 3, false);
    expect(isOnPlot(off, 3)).toBe(false);
    expect(isOnPlot(off, 2)).toBe(true);
    expect(editKey(off)).not.toBe(editKey(doc));
    expect(editKey(withOnPlot(off, 3, true))).toBe(editKey(doc));
  });

  it('do not depend on whether the card is chosen for printing', () => {
    const doc = withPrinted(fresh(), 1, false);
    expect(isOnPlot(doc, 1)).toBe(true);
    const off = withOnPlot(fresh(), 1, false);
    expect(off.noPrint).toEqual({});
  });

  it('show the Position dots and the outlines until the person hides them, and a change counts as an edit', () => {
    const doc = fresh();
    expect(plotShown(doc)).toEqual({ position: true, outlines: true });
    const hidden = withPlotShow(doc, { position: false });
    expect(plotShown(hidden)).toEqual({ position: false, outlines: true });
    expect(editKey(hidden)).not.toBe(editKey(doc));
    const both = withPlotShow(hidden, { outlines: false });
    expect(plotShown(both)).toEqual({ position: false, outlines: false });
    expect(editKey(withPlotShow(both, { position: true, outlines: true }))).toBe(editKey(doc));
  });

  it('keep the choice of what the plot shows for this session only on a read-only file', () => {
    const locked = { ...fresh(), locked: true };
    const off = withPlotShow(locked, { outlines: false });
    expect(plotShown(off)).toEqual({ position: true, outlines: false });
    expect(off.plotShow).toEqual({ position: true, outlines: true });
    expect(editKey(off)).toBe(editKey(locked));
  });

  it('turn Print rigging plot off by choice, and off by themselves when no array is on the plot', () => {
    const doc = fresh();
    const choice = withPlotPrinted(doc, false);
    expect(plotPrintChosen(choice)).toBe(false);
    expect(model(choice).printsPlot).toBe(false);
    expect(model(choice).hasPlot).toBe(true);
    expect(editKey(choice)).not.toBe(editKey(doc));
    let none = doc;
    doc.result.report.sources.forEach((_, i) => (none = withOnPlot(none, i, false)));
    expect(model(none, true).hasPlot).toBe(false);
    expect(model(none, true).printsPlot).toBe(false);
    // The choice itself is still on, so putting an array back prints the plot again.
    expect(none.plotPrintOff).toBe(false);
    expect(model(withOnPlot(none, 4, true), true).printsPlot).toBe(true);
  });

  it('count the card that stands for a collapsed pair, not the hidden partner on its own', () => {
    const doc = fresh();
    const left = doc.result.report.sources.findIndex((s) => s.name === 'KARA II L Main');
    let cardsOff = doc;
    doc.result.report.sources.forEach((_, i) => (cardsOff = withOnPlot(cardsOff, i, i === left + 1)));
    // Only the hidden mirror image's own tick is on: with the pair collapsed, its card decides, so nothing is on the plot.
    expect(model(cardsOff, false).plottedSources.has(left + 1)).toBe(false);
    expect(model(cardsOff, true).plottedSources.has(left + 1)).toBe(true);
  });

  it('ignore a deleted array when asking whether any array is on the plot', () => {
    let doc = fresh();
    doc.result.report.sources.forEach((_, i) => (doc = i === 0 ? doc : withOnPlot(doc, i, false)));
    expect(model(doc, true).hasPlot).toBe(true);
    expect(model(withDeleted(doc, 0, true), true).hasPlot).toBe(false);
  });

  it('on a read-only file are choices for this session only, and never change what is saved', () => {
    const locked = { ...fresh(), locked: true };
    const off = withOnPlot(locked, 2, false);
    expect(isOnPlot(off, 2)).toBe(false);
    expect(off.noPlot).toEqual({});
    expect(editKey(off)).toBe(editKey(locked));
    const unprinted = withPlotPrinted(locked, false);
    expect(plotPrintChosen(unprinted)).toBe(false);
    expect(model(unprinted).printsPlot).toBe(false);
    expect(unprinted.plotPrintOff).toBe(false);
    expect(editKey(unprinted)).toBe(editKey(locked));
  });

  it('stay with the array of the same name when the report is updated', () => {
    let doc = withOnPlot(fresh(), 2, false);
    doc = withPlotPrinted(doc, false);
    const out = updatedDoc(doc, parseFixture('a'), 'new.pdf');
    expect(out.noPlot).toEqual({ 2: true });
    expect(out.plotPrintOff).toBe(true);
    expect(out.plotOverride).toBeNull();
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

describe('the value written for each plot symbol', () => {
  it('starts with the usual values, and a change is kept for that shape only', () => {
    const doc = fresh();
    expect(symbolValueOf(doc, 'one')).toBe('1 t');
    const set = withSymbolValue(doc, 'one', ' 1.5 t ');
    expect(symbolValueOf(set, 'one')).toBe('1.5 t');
    expect(symbolValueOf(set, 'two')).toBe('2 t');
  });

  it('is one line of at most 12 characters, and a blank one goes back to the usual value', () => {
    const doc = withSymbolValue(fresh(), 'quarter', 'x'.repeat(30) + '\n');
    expect(symbolValueOf(doc, 'quarter')).toBe('x'.repeat(12));
    expect(symbolValueOf(withSymbolValue(doc, 'quarter', '   '), 'quarter')).toBe('0.25 t');
  });

  it('counts as a change to save, and changing back puts it right again', () => {
    const doc = fresh();
    doc.savedKey = editKey(doc);
    const set = withSymbolValue(doc, 'two', '3 t');
    expect(editKey(set)).not.toBe(doc.savedKey);
    expect(editKey(withSymbolValue(set, 'two', '2 t'))).toBe(doc.savedKey);
  });

  it('cannot change in a read-only file', () => {
    const locked = { ...fresh(), locked: true };
    expect(withSymbolValue(locked, 'one', '1.5 t')).toBe(locked);
    expect(withSymbolValuesReset({ ...locked, symbolValues: { ...locked.symbolValues, one: '1.5 t' } }).symbolValues.one).toBe('1.5 t');
  });

  it('go back to the usual values together, and stay through Update from PDF', () => {
    const set = withSymbolValue(withSymbolValue(fresh(), 'one', '1.5 t'), 'half', '0.4 t');
    const updated = updatedDoc(set, parseFixture('c'), 'c2.pdf');
    expect(symbolValueOf(updated, 'one')).toBe('1.5 t');
    expect(symbolValueOf(updated, 'half')).toBe('0.4 t');
    const reset = withSymbolValuesReset(set);
    expect(reset.symbolValues).toEqual({ two: '2 t', one: '1 t', half: '0.5 t', quarter: '0.25 t' });
    expect(withSymbolValuesReset(reset)).toBe(reset);
  });
});

describe('plot symbols', () => {
  const choose = { shape: 'two' } as const;

  it('are the 1 ton circle until one is chosen, and a choice is kept for the front and the rear separately', () => {
    const doc = fresh();
    expect(markerOf(doc, 3, 'front')).toEqual({ shape: 'one' });
    const set = withMarker(doc, 3, 'rear', choose);
    expect(markerOf(set, 3, 'rear')).toEqual(choose);
    expect(markerOf(set, 3, 'front')).toEqual({ shape: 'one' });
    expect(markerOf(set, 4, 'rear')).toEqual({ shape: 'one' });
  });

  it('count as a change to save, and changing back puts it right again', () => {
    const doc = fresh();
    doc.savedKey = editKey(doc);
    const set = withMarker(doc, 3, 'front', choose);
    expect(editKey(set)).not.toBe(doc.savedKey);
    expect(editKey(withMarker(set, 3, 'front', { shape: 'one' }))).toBe(doc.savedKey);
  });

  it('on a read-only file are kept for this session only, like the print choice', () => {
    const locked = { ...fresh(), locked: true };
    locked.savedKey = editKey(locked);
    const set = withMarker(locked, 3, 'front', choose);
    expect(markerOf(set, 3, 'front')).toEqual(choose);
    expect(set.markers).toEqual({});
    expect(editKey(set)).toBe(locked.savedKey);
    const again = withMarker(set, 5, 'rear', { shape: 'half' });
    expect(markerOf(again, 3, 'front')).toEqual(choose);
    expect(markerOf(again, 5, 'rear')).toEqual({ shape: 'half' });
  });

  it('go with an array through Update from PDF when its pickup is still there, and are reset when it is not', () => {
    const doc = newDoc(parseFixture('c'), 'c.pdf');
    const sources = doc.result.report.sources;
    const i = sources.findIndex((s) => s.pickups.some((p) => p.which === 'front') && s.pickups.some((p) => p.which === 'rear'));
    const set = withMarker(withMarker(doc, i, 'front', choose), i, 'rear', { shape: 'half' });
    const same = updatedDoc(set, parseFixture('c'), 'c2.pdf');
    expect(markerOf(same, i, 'front')).toEqual(choose);
    expect(markerOf(same, i, 'rear')).toEqual({ shape: 'half' });
    const changed = structuredClone(parseFixture('c'));
    changed.report.sources[i]!.pickups.find((p) => p.which === 'rear')!.position += 1;
    const next = updatedDoc(set, changed, 'c3.pdf');
    expect(markerOf(next, i, 'front')).toEqual(choose);
    expect(markerOf(next, i, 'rear')).toEqual({ shape: 'one' });
  });
});
