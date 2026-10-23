/* eslint-disable @typescript-eslint/no-explicit-any -- these tests poke arbitrary JSON into a saved file */
import { describe, expect, it } from 'vitest';
import { newDoc, editKey, type Doc } from './doc';
import { docToFile, openFileText, serialiseDoc } from './array-file-io';
import { MAX_FILE_BYTES } from './limits';
import { FileError } from './migrations';
import { parseFixture } from '../testing/fixtures';

const NOW = new Date('2026-10-22T10:30:00.000Z');

function sample(name: 'a' | 'b' | 'd' | 'e' = 'a'): Doc {
  const doc = newDoc(parseFixture(name), `report-${name}.pdf`);
  doc.job = { show: 'Main stage', venue: 'Grand Hall', engineer: 'Sam', company: 'Acme', zAxisZero: 'Arena floor', defaultOffset: '0.3', origin: 'Iron Line', sideLabels: false };
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
    expect(docToFile(doc, '0.1.0', NOW).format).toBe('arraysheet/6');
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
    expect(() => open('not json')).toThrow(/not a RigPoint Array file/);
    expect(() => open('')).toThrow(FileError);
  });

  it('refuses JSON that is not an array file', () => {
    expect(() => open('[]')).toThrow(/not a RigPoint Array file/);
    expect(() => open('{"format":"loadsheet/1"}')).toThrow(/not a RigPoint Array file/);
  });

  it('refuses a file from a newer version', () => {
    expect(() => open(edited((f) => (f.format = 'arraysheet/9')))).toThrow(/newer version/);
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
