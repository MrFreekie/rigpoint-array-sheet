/* eslint-disable @typescript-eslint/no-explicit-any -- these tests poke arbitrary JSON into a saved file */
import { describe, expect, it } from 'vitest';
import { newDoc, editKey, patchOf, withPatch, type Doc } from './doc';
import { docToFile, openFileText, serialiseDoc } from './array-file-io';
import { MAX_FILE_BYTES } from './limits';
import { FileError } from './migrations';
import { parseFixture } from '../testing/fixtures';

const NOW = new Date('2026-10-22T10:30:00.000Z');

function sample(name: 'a' | 'b' | 'd' | 'e' = 'a'): Doc {
  const doc = newDoc(parseFixture(name), `report-${name}.pdf`);
  doc.job = { show: 'Main stage', venue: 'Grand Hall', engineer: 'Sam', company: 'Acme', zAxisZero: 'Arena floor', defaultOffset: '0.3', origin: 'Iron Line', sideLabels: false, notes: '', showDate: '' };
  doc.offsets = { 0: '1.5', 4: '-0.2' };
  doc.revision = 'B';
  doc.status = 'issued';
  return doc;
}

const roundTrip = (doc: Doc) => openFileText(serialiseDoc(doc, '0.1.0', NOW), 'name.arraysheet.json');

describe('side labels', () => {
  it('are saved and opened again', () => {
    expect(roundTrip(sample()).doc.job.sideLabels).toBe(false);
    expect(JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)).job.side_labels).toBe(false);
  });

  it('are shown in a version 5 file', () => {
    const v5 = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { format: string; job: Record<string, unknown> };
    v5.format = 'arraysheet/5';
    delete v5.job['side_labels'];
    expect(openFileText(JSON.stringify(v5), null).doc.job.sideLabels).toBe(true);
  });

  it('are refused when they are not true or false', () => {
    const f = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { job: Record<string, unknown> };
    f.job['side_labels'] = 'no';
    expect(() => openFileText(JSON.stringify(f), null)).toThrow(/Side labels must be true or false/);
  });
});

describe('origin', () => {
  it('is saved and opened again', () => {
    expect(roundTrip(sample()).doc.job.origin).toBe('Iron Line');
    expect(JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)).job.origin).toBe('Iron Line');
  });

  it('is blank in a version 5 file', () => {
    const v5 = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { format: string; job: Record<string, unknown> };
    v5.format = 'arraysheet/5';
    delete v5.job['origin'];
    expect(openFileText(JSON.stringify(v5), null).doc.job.origin).toBe('');
  });

  it('is refused when it is not text', () => {
    const f = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { job: Record<string, unknown> };
    f.job['origin'] = 5;
    expect(() => openFileText(JSON.stringify(f), null)).toThrow(/Origin \(P0\) must be text/);
  });
});

describe('show date', () => {
  it('is saved as YYYY-MM-DD and comes back', () => {
    const doc = sample();
    doc.job = { ...doc.job, showDate: '2026-10-23' };
    expect(JSON.parse(serialiseDoc(doc, '0.1.0', NOW)).job.show_date).toBe('2026-10-23');
    expect(roundTrip(doc).doc.job.showDate).toBe('2026-10-23');
    expect(roundTrip(sample()).doc.job.showDate).toBe('');
  });

  it('is blank in a version 6 file', () => {
    const v6 = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { format: string; job: Record<string, unknown>; titles?: unknown; notes?: unknown; deleted?: unknown };
    v6.format = 'arraysheet/6';
    delete v6.job['show_date'];
    delete v6.job['notes'];
    delete v6.titles;
    delete v6.notes;
    delete v6.deleted;
    expect(openFileText(JSON.stringify(v6), null).doc.job.showDate).toBe('');
  });

  it('is refused when it is not a real calendar date or not text, and blank is fine', () => {
    const f = () => JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { job: Record<string, unknown> };
    for (const bad of ['23/10/2026', '2026-02-30', '2026-13-01', 'tomorrow']) {
      const file = f();
      file.job['show_date'] = bad;
      expect(() => openFileText(JSON.stringify(file), null), bad).toThrow(/show date must be a real date or blank/i);
    }
    const odd = f();
    odd.job['show_date'] = 5;
    expect(() => openFileText(JSON.stringify(odd), null)).toThrow(/Show date must be text/);
    const blank = f();
    blank.job['show_date'] = '';
    expect(() => openFileText(JSON.stringify(blank), null)).not.toThrow();
  });
});

describe('show notes', () => {
  it('are saved with line breaks and come back', () => {
    const doc = sample();
    doc.job = { ...doc.job, notes: 'Load in at 08:00.\nCall Sam first.' };
    expect(JSON.parse(serialiseDoc(doc, '0.1.0', NOW)).job.notes).toBe('Load in at 08:00.\nCall Sam first.');
    expect(roundTrip(doc).doc.job.notes).toBe('Load in at 08:00.\nCall Sam first.');
  });

  it('are blank in a version 6 file', () => {
    const v6 = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { format: string; job: Record<string, unknown>; titles?: unknown; notes?: unknown; deleted?: unknown };
    v6.format = 'arraysheet/6';
    delete v6.job['notes'];
    delete v6.titles;
    delete v6.notes;
    delete v6.deleted;
    expect(openFileText(JSON.stringify(v6), null).doc.job.notes).toBe('');
  });

  it('are refused when they are over 500 characters, not text, or hold control characters', () => {
    const f = () => JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { job: Record<string, unknown> };
    const long = f();
    long.job['notes'] = 'x'.repeat(501);
    expect(() => openFileText(JSON.stringify(long), null)).toThrow(/Show notes is too long/);
    const odd = f();
    odd.job['notes'] = 5;
    expect(() => openFileText(JSON.stringify(odd), null)).toThrow(/Show notes must be text/);
    const ctl = f();
    ctl.job['notes'] = 'bell\u0007';
    expect(() => openFileText(JSON.stringify(ctl), null)).toThrow(/show notes cannot hold control characters/i);
    const ok = f();
    ok.job['notes'] = 'x'.repeat(500);
    expect(() => openFileText(JSON.stringify(ok), null)).not.toThrow();
  });
});

describe('rigging plot choices', () => {
  it('are saved with the file and come back, apart from the read-only session choices', () => {
    const doc = sample();
    doc.noPlot = { 0: true, 7: true };
    doc.plotPrintOff = true;
    const file = docToFile(doc, '0.1.0', NOW);
    expect(file.plot).toHaveLength(18);
    expect(file.plot.map((p, i) => (p ? null : i)).filter((i) => i !== null)).toEqual([0, 7]);
    expect(file.print_plot).toBe(false);
    const back = roundTrip(doc).doc;
    expect(back.noPlot).toEqual({ 0: true, 7: true });
    expect(back.plotPrintOff).toBe(true);
    expect(back.plotOverride).toBeNull();
    expect(back.plotPrintOverride).toBeNull();
  });

  it('are all on for a new document', () => {
    const file = docToFile(sample(), '0.1.0', NOW);
    expect(file.plot.every(Boolean)).toBe(true);
    expect(file.print_plot).toBe(true);
  });

  it('a read-only override is not saved', () => {
    const doc = sample();
    doc.locked = true;
    doc.plotOverride = { 2: true };
    doc.plotPrintOverride = true;
    const file = docToFile(doc, '0.1.0', NOW);
    expect(file.plot.every(Boolean)).toBe(true);
    expect(file.print_plot).toBe(true);
  });

  it('are refused when the list does not have one choice for each array', () => {
    const f = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { plot: boolean[] };
    f.plot.pop();
    expect(() => openFileText(JSON.stringify(f), null)).toThrow(/one rigging plot choice for each array/);
  });
});

describe('print choices', () => {
  it('are saved with the file and come back', () => {
    const doc = sample();
    doc.noPrint = { 1: true, 5: true };
    const file = docToFile(doc, '0.1.0', NOW);
    expect(file.print).toHaveLength(18);
    expect(file.print.map((p, i) => (p ? null : i)).filter((i) => i !== null)).toEqual([1, 5]);
    expect(roundTrip(doc).doc.noPrint).toEqual({ 1: true, 5: true });
  });

  it('are all on for a new document', () => {
    expect(docToFile(sample(), '0.1.0', NOW).print.every(Boolean)).toBe(true);
  });

  it('a read-only override is not saved', () => {
    const doc = sample();
    doc.locked = true;
    doc.printOverride = { 2: true };
    expect(docToFile(doc, '0.1.0', NOW).print.every(Boolean)).toBe(true);
  });

  it('an older (version 2) file opens with no venue, and the rest as saved', () => {
    const v2 = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { format: string; job: Record<string, unknown> };
    delete v2.job['venue'];
    v2.format = 'arraysheet/2';
    const { doc } = openFileText(JSON.stringify(v2), 'old.arraysheet.json');
    expect(doc.job.venue).toBe('');
    expect(doc.job.show).toBe('Main stage');
  });

  it('an older (version 3) file opens as saved, and a stack in columns keeps its columns', () => {
    const v3 = JSON.parse(serialiseDoc(sample('d'), '0.1.0', NOW)) as { format: string };
    v3.format = 'arraysheet/3';
    const { doc } = openFileText(JSON.stringify(v3), 'old.arraysheet.json');
    expect(doc.job.show).toBe('Main stage');
    expect(doc.result.report.sources[4]?.cabinets.map((c) => c.column)).toEqual([1, 2]);
  });

  it('an older (version 4) file opens as saved, with the fixations of its stacks neither stripped nor invented', () => {
    const saved = sample('e');
    const v4 = JSON.parse(serialiseDoc(saved, '0.1.0', NOW)) as { format: string };
    v4.format = 'arraysheet/4';
    const { doc } = openFileText(JSON.stringify(v4), 'old.arraysheet.json');
    expect(doc.job.show).toBe('Main stage');
    expect(doc.result.report.sources.map((s) => s.fixations)).toEqual(saved.result.report.sources.map((s) => s.fixations));
    expect(doc.result.report.sources.filter((s) => s.fixations !== undefined)).toHaveLength(8);
  });

  it('a file saved before fixations existed opens with none on any array', () => {
    const old = JSON.parse(serialiseDoc(sample('d'), '0.1.0', NOW)) as { format: string; report: { sources: Record<string, unknown>[] } };
    for (const s of old.report.sources) {
      delete s['fixations'];
      delete s['fixationCount'];
    }
    old.format = 'arraysheet/3';
    const { doc } = openFileText(JSON.stringify(old), 'old.arraysheet.json');
    expect(doc.result.report.sources).toHaveLength(parseFixture('d').report.sources.length);
    expect(doc.result.report.sources.some((s) => s.fixations !== undefined || s.fixationCount !== undefined)).toBe(false);
  });

  it('fixations come back exactly as saved', () => {
    const { doc } = roundTrip(sample('e'));
    expect(doc.result.report.sources[10]?.fixationCount).toBe(4);
    expect(doc.result.report.sources[10]?.fixations).toEqual([
      { name: 'Fr', at: { x: -2.84, y: 4.6, z: 1 } },
      { name: 'Fl', at: { x: -2.16, y: 4.6, z: 1 } },
      { name: 'Rr', at: { x: -2.84, y: 3.9, z: 1 } },
      { name: 'Rl', at: { x: -2.16, y: 3.9, z: 1 } },
    ]);
    expect(doc.result.report.sources[0]?.fixations).toBeUndefined();
  });

  it('refuses a fixation name that is too long', () => {
    const file = JSON.parse(serialiseDoc(sample('e'), '0.1.0', NOW)) as { report: { sources: { fixations: { name: string }[] }[] } };
    file.report.sources[10]!.fixations[0]!.name = 'F'.repeat(2001);
    expect(() => openFileText(JSON.stringify(file), 'x.arraysheet.json')).toThrow(/too long/);
  });

  it('refuses a file that holds too many fixations for an array', () => {
    const file = JSON.parse(serialiseDoc(sample('e'), '0.1.0', NOW)) as { report: { sources: { fixations: unknown[] }[] } };
    file.report.sources[10]!.fixations = Array.from({ length: 17 }, () => ({ name: 'Fr', at: { x: 0, y: 0, z: 0 } }));
    expect(() => openFileText(JSON.stringify(file), 'x.arraysheet.json')).toThrow(/more than 16 fixations/);
  });

  it('an older (version 1) file opens with every array chosen for printing', () => {
    const v1 = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as Record<string, unknown>;
    delete v1['print'];
    delete (v1['job'] as Record<string, unknown>)['venue'];
    v1['format'] = 'arraysheet/1';
    const { doc } = openFileText(JSON.stringify(v1), 'old.arraysheet.json');
    expect(doc.noPrint).toEqual({});
    expect(doc.job.show).toBe('Main stage');
    expect(doc.result.report.sources).toHaveLength(18);
  });
});

describe('saving and opening', () => {
  it.each(['a', 'b', 'e'] as const)('report %s comes back exactly as saved', (name) => {
    const doc = sample(name);
    const { doc: back, savedAt } = roundTrip(doc);
    expect(savedAt).toBe(NOW.toISOString());
    expect(back.result).toEqual(doc.result);
    expect(back.job).toEqual(doc.job);
    expect(back.job.venue).toBe('Grand Hall');
    expect(back.offsets).toEqual(doc.offsets);
    expect(back.status).toBe('issued');
    expect(back.revision).toBe('B');
    expect(back.sourceName).toBe(`report-${name}.pdf`);
  });

  it('a draft or issued file opens editable, an approved or superseded one opens locked', () => {
    for (const [status, locked] of [['draft', false], ['issued', false], ['approved', true], ['superseded', true]] as const) {
      const doc = sample();
      doc.status = status;
      expect(roundTrip(doc).doc.locked).toBe(locked);
    }
  });

  it('an opened file is clean, with the name it was opened from', () => {
    const { doc } = roundTrip(sample());
    expect(doc.fileName).toBe('name.arraysheet.json');
    expect(doc.savedKey).toBe(editKey(doc));
  });

  it('saving twice gives the same text apart from the time', () => {
    const doc = sample();
    expect(serialiseDoc(doc, '0.1.0', NOW)).toBe(serialiseDoc(doc, '0.1.0', NOW));
    expect(docToFile(doc, '0.1.0', NOW).format).toBe('arraysheet/13');
  });

  it('writes one offset per array, blank where none was typed', () => {
    const file = docToFile(sample(), '0.1.0', NOW);
    expect(file.offsets).toHaveLength(18);
    expect(file.offsets[0]).toBe('1.5');
    expect(file.offsets[1]).toBe('');
    expect(file.offsets[4]).toBe('-0.2');
  });

  it('keeps problems, and an error problem means the report is not ok', () => {
    const doc = sample();
    doc.result = { ...doc.result, problems: [{ level: 'error', source: null, message: 'Units are wrong.' }], ok: false };
    const back = roundTrip(doc).doc;
    expect(back.result.ok).toBe(false);
    expect(back.result.problems).toHaveLength(1);
  });

  it('a file with the saved date stays readable if the text has odd characters', () => {
    const doc = sample();
    doc.job.show = 'Café "Ünïcode" \u{1F3B8} <b>';
    expect(roundTrip(doc).doc.job.show).toBe(doc.job.show);
  });
});

function edited(change: (f: Record<string, any>) => void): string {
  const f = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as Record<string, any>;
  change(f);
  return JSON.stringify(f);
}

const open = (text: string) => openFileText(text, null);

describe('opening a bad file', () => {
  it('refuses text that is not JSON', () => {
    expect(() => open('not json')).toThrow(/not a RigPoint Array Sheet file/);
    expect(() => open('')).toThrow(FileError);
  });

  it('refuses JSON that is not an array file', () => {
    expect(() => open('[]')).toThrow(/not a RigPoint Array Sheet file/);
    expect(() => open('{"format":"loadsheet/1"}')).toThrow(/not a RigPoint Array Sheet file/);
  });

  it('refuses a file from a newer version', () => {
    expect(() => open(edited((f) => (f.format = 'arraysheet/14')))).toThrow(/newer version/);
  });

  it('refuses a file over the size limit', () => {
    expect(() => open('x'.repeat(MAX_FILE_BYTES + 1))).toThrow(/larger than/);
  });

  const cases: [string, (f: Record<string, any>) => void, RegExp][] = [
    ['status', (f) => (f.status = 'final'), /Status: Status must be draft, issued, approved or superseded/],
    ['revision', (f) => (f.revision = 'b2'), /Revision: Revision must be blank or one or two capital letters/],
    ['saved_at', (f) => (f.saved_at = 'yesterday'), /Saved at: Saved at must be a date and time/],
    ['show', (f) => (f.job.show = 5), /Show details, Show: Show must be text/],
    ['show length', (f) => (f.job.show = 'x'.repeat(501)), /Show is too long/],
    ['offsets length', (f) => f.offsets.pop(), /Ground offsets: There must be one ground offset for each array/],
    ['print count', (f) => f.print.pop(), /Print choices: There must be one print choice for each array/],
    ['print type', (f) => (f.print[0] = 'yes'), /Print choices, entry 1: Print must be true or false/],
    ['offset type', (f) => (f.offsets[0] = 1), /Ground offsets, entry 1: Ground offset must be text/],
    ['report missing', (f) => delete f.report, /Report: is missing/],
    ['job missing', (f) => delete f.job, /Show details: is missing/],
    ['sources not a list', (f) => (f.report.sources = 'many'), /Arrays: Sources must be a list/],
    ['weight type', (f) => (f.report.sources[2].weights.total = 'heavy'), /Array 3, Weights, Total weight: must be a number/],
    ['cabinet height', (f) => (f.report.sources[0].cabinets[1].topZ = 'high'), /Array 1, Enclosures, entry 2, Top height: must be a number/],
    ['problems type', (f) => (f.problems = 'none'), /Problems: Problems must be a list/],
    ['too many enclosures', (f) => (f.report.sources[0].cabinets = Array.from({ length: 201 }, () => f.report.sources[0].cabinets[0])), /more than 200 enclosures/],
    ['too many pickups', (f) => (f.report.sources[0].pickups = Array.from({ length: 9 }, () => f.report.sources[0].pickups[0])), /more than 8 pickups/],
  ];

  it.each(cases)('names the field when %s is wrong', (_what, change, message) => {
    expect(() => open(edited(change))).toThrow(message);
  });

  it('reports at most five problems and says how many more', () => {
    const text = edited((f) => {
      f.status = 'x';
      f.revision = '1';
      f.saved_at = 'x';
      f.job.show = 1;
      f.job.engineer = 1;
      f.job.company = 1;
      f.job.z_axis_zero = 1;
    });
    expect(() => open(text)).toThrow(/and 2 more problems/);
  });

  it('never throws anything but a FileError, even for hostile input', () => {
    const hostile = ['{}', '{"format":"arraysheet/2"}', '{"format":"arraysheet/2","report":null}', '{"__proto__":{"x":1}}', 'null', '12', '"text"'];
    for (const text of hostile) {
      let error: unknown;
      try {
        open(text);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(FileError);
    }
  });
});

describe('titles, notes and deleted arrays', () => {
  const edited = () => {
    const doc = sample();
    doc.titles = { 1: 'Front left' };
    doc.notes = { 1: 'Rig first.\nCheck the motor.' };
    doc.deleted = { 3: true };
    return doc;
  };

  it('are saved and opened again', () => {
    const f = JSON.parse(serialiseDoc(edited(), '0.1.0', NOW));
    expect(f.titles[1]).toBe('Front left');
    expect(f.titles[0]).toBe('');
    expect(f.notes[1]).toBe('Rig first.\nCheck the motor.');
    expect(f.deleted[3]).toBe(true);
    expect(f.deleted[0]).toBe(false);
    const back = roundTrip(edited()).doc;
    expect(back.titles).toEqual({ 1: 'Front left' });
    expect(back.notes).toEqual({ 1: 'Rig first.\nCheck the motor.' });
    expect(back.deleted).toEqual({ 3: true });
  });

  it('keep the data of a deleted array in the file', () => {
    const doc = edited();
    const f = JSON.parse(serialiseDoc(doc, '0.1.0', NOW));
    expect(f.report.sources).toHaveLength(doc.result.report.sources.length);
  });

  it('are not counted as saved changes after opening', () => {
    const back = roundTrip(edited()).doc;
    expect(back.savedKey).toBe(editKey(back));
  });

  it('are refused when a list is the wrong length', () => {
    for (const key of ['titles', 'notes', 'deleted']) {
      const f = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as Record<string, unknown[]>;
      f[key]!.pop();
      expect(() => openFileText(JSON.stringify(f), null)).toThrow(FileError);
    }
  });

  it('refuse a title over 60 characters and a note over 300', () => {
    const t = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { titles: string[]; notes: string[] };
    t.titles[0] = 'x'.repeat(61);
    expect(() => openFileText(JSON.stringify(t), null)).toThrow(/Title is too long/);
    t.titles[0] = 'x'.repeat(60);
    t.notes[0] = 'x'.repeat(301);
    expect(() => openFileText(JSON.stringify(t), null)).toThrow(/Notes is too long/);
    t.notes[0] = 'x'.repeat(300);
    expect(() => openFileText(JSON.stringify(t), null)).not.toThrow();
  });

  it('refuse a title with a line break, and a note with any control character other than one', () => {
    const t = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { titles: string[]; notes: string[] };
    t.titles[0] = 'one\ntwo';
    expect(() => openFileText(JSON.stringify(t), null)).toThrow(/title cannot hold line breaks/i);
    t.titles[0] = '';
    t.notes[0] = 'a\u0007b';
    expect(() => openFileText(JSON.stringify(t), null)).toThrow(/note cannot hold control characters/i);
    t.notes[0] = 'one\ntwo';
    expect(() => openFileText(JSON.stringify(t), null)).not.toThrow();
  });

  it('are added, blank, when a version 6 file is opened', () => {
    const f = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as Record<string, unknown>;
    f['format'] = 'arraysheet/6';
    delete f['titles'];
    delete f['notes'];
    delete f['deleted'];
    const back = openFileText(JSON.stringify(f), null).doc;
    expect(back.titles).toEqual({});
    expect(back.notes).toEqual({});
    expect(back.deleted).toEqual({});
  });
});

describe('pickup symbols', () => {
  const v7 = () => {
    const f = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW)) as { format: string; markers?: unknown; [k: string]: unknown };
    f.format = 'arraysheet/7';
    delete f.markers;
    return f;
  };

  it('are saved, one pair for each array, and come back', () => {
    const doc = sample();
    doc.markers = { 2: { front: { shape: 'two', text: '' }, rear: { shape: 'quarter', text: '1.5 t' } } };
    const file = docToFile(doc, '0.1.0', NOW);
    expect(file.markers).toHaveLength(doc.result.report.sources.length);
    expect(file.markers[0]).toEqual({ front: { shape: 'one', text: '' }, rear: { shape: 'one', text: '' } });
    expect(file.markers[2]).toEqual({ front: { shape: 'two', text: '' }, rear: { shape: 'quarter', text: '1.5 t' } });
    expect(roundTrip(doc).doc.markers).toEqual(doc.markers);
  });

  it('are not listed for an array left at the default, so an opened file has none', () => {
    expect(roundTrip(sample()).doc.markers).toEqual({});
  });

  it('are not counted as unsaved after opening, and a change is', () => {
    const opened = roundTrip({ ...sample(), markers: { 1: { front: { shape: 'half', text: '' }, rear: { shape: 'one', text: '' } } } }).doc;
    expect(editKey(opened)).toBe(opened.savedKey);
    expect(editKey({ ...opened, markers: {} })).not.toBe(opened.savedKey);
  });

  it('are the 1 ton symbol everywhere in a version 7 file', () => {
    const opened = openFileText(JSON.stringify(v7()), null).doc;
    expect(opened.markers).toEqual({});
  });

  it('a read-only override is not saved', () => {
    const doc = { ...sample(), markerOverride: { 0: { front: { shape: 'two', text: '' }, rear: { shape: 'two', text: '' } } } } as Doc;
    expect(docToFile(doc, '0.1.0', NOW).markers[0]).toEqual({ front: { shape: 'one', text: '' }, rear: { shape: 'one', text: '' } });
  });

  it('are refused when the list is the wrong length, a shape is not one of the four, or the text is too long or holds a control character', () => {
    const bad = (change: (f: any) => void, message: RegExp) => {
      const f = JSON.parse(serialiseDoc(sample(), '0.1.0', NOW));
      change(f);
      expect(() => openFileText(JSON.stringify(f), null)).toThrow(message);
    };
    bad((f) => f.markers.pop(), /one pair of pickup symbols for each array/);
    bad((f) => (f.markers[0].front.shape = 'three'), /pickup symbol must be/);
    bad((f) => (f.markers[0].rear.text = 'x'.repeat(13)), /symbol value is too long/);
    bad((f) => (f.markers[0].rear.text = 'a\nb'), /cannot hold line breaks or control characters/);
    bad((f) => (f.markers = 'many'), /must be a list/);
  });
});

describe('cable patch', () => {
  const a = () => sample();
  const rowsOf = (doc: Doc, i: number) => doc.result.report.sources[i]?.cabinets.length ?? 0;

  it('is saved as one feeder and way for each enclosure row of each array, blank where nothing was chosen', () => {
    const doc = withPatch(withPatch(a(), 1, 0, 'feeder', '1'), 1, 2, 'way', '0');
    const file = docToFile(doc, '0.1.0', NOW);
    expect(file.patch).toHaveLength(doc.result.report.sources.length);
    file.patch.forEach((rows, i) => expect(rows).toHaveLength(rowsOf(doc, i)));
    expect(file.patch[1]?.[0]).toEqual({ feeder: '1', way: '' });
    expect(file.patch[1]?.[2]).toEqual({ feeder: '', way: '0' });
    expect(file.patch[0]?.every((r) => r.feeder === '' && r.way === '')).toBe(true);
  });

  it('comes back when the file is opened, and an array with nothing set is not listed', () => {
    const doc = withPatch(withPatch(a(), 2, 1, 'feeder', '9'), 2, 1, 'way', '4');
    const back = roundTrip(doc).doc;
    expect(back.patches).toEqual({ 2: expect.arrayContaining([{ feeder: '9', way: '4' }]) });
    expect(Object.keys(back.patches)).toEqual(['2']);
    expect(roundTrip(a()).doc.patches).toEqual({});
  });

  it('is not counted as unsaved after opening, and a change is', () => {
    const opened = roundTrip(withPatch(a(), 0, 0, 'feeder', '2')).doc;
    expect(editKey(opened)).toBe(opened.savedKey);
    expect(editKey(withPatch(opened, 0, 0, 'feeder', '3'))).not.toBe(opened.savedKey);
    expect(editKey(withPatch(opened, 0, 0, 'feeder', ''))).not.toBe(opened.savedKey);
  });

  it('is blank everywhere in a version 9 file', () => {
    const f = JSON.parse(serialiseDoc(withPatch(a(), 0, 0, 'feeder', '2'), '0.1.0', NOW)) as { format: string; patch?: unknown };
    f.format = 'arraysheet/9';
    delete f.patch;
    const opened = openFileText(JSON.stringify(f), null).doc;
    expect(opened.patches).toEqual({});
    expect(docToFile(opened, '0.1.0', NOW).patch[0]).toHaveLength(rowsOf(opened, 0));
  });

  it('cannot be changed once the file is approved or superseded, and is kept when it is opened', () => {
    const approved = roundTrip({ ...withPatch(a(), 0, 0, 'way', '5'), status: 'approved' }).doc;
    expect(approved.locked).toBe(true);
    expect(withPatch(approved, 0, 0, 'way', '6')).toBe(approved);
    expect(patchOf(approved, 0)[0]).toEqual({ feeder: '', way: '5' });
  });

  it('is refused when the lists are the wrong length, or a value is not one digit or blank', () => {
    const bad = (change: (f: any) => void, message: RegExp) => {
      const f = JSON.parse(serialiseDoc(a(), '0.1.0', NOW));
      change(f);
      expect(() => openFileText(JSON.stringify(f), null)).toThrow(message);
    };
    bad((f) => f.patch.pop(), /one cable patch for each array/);
    bad((f) => f.patch[0].pop(), /must have one feeder and way for each of its \d+ enclosures/);
    bad((f) => f.patch[0].push({ feeder: '', way: '' }), /must have one feeder and way/);
    bad((f) => (f.patch[0][0].feeder = '10'), /one digit, 0 to 9, or blank/);
    bad((f) => (f.patch[0][0].way = 'a'), /one digit, 0 to 9, or blank/);
    bad((f) => (f.patch[0][0].way = 4), /one digit, 0 to 9, or blank/);
    bad((f) => (f.patch[0][0].feeder = ' 1'), /one digit, 0 to 9, or blank/);
    bad((f) => (f.patch = 'many'), /must be a list/);
    bad((f) => (f.patch[0] = 'x'), /must be a list/);
    bad((f) => delete f.patch, /Cable patches must be a list|Required|expected array/i);
  });
});
