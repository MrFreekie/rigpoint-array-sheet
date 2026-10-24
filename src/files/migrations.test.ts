import { describe, expect, it } from 'vitest';
import { FileError, migrate, MIGRATIONS } from './migrations';

const one = { shape: 'one', text: '' };
const plain = { front: one, rear: one };
/** What step 10 adds: the usual cart sizes and every array automatic. */
const sizes = [
  { type: 'K2', size: 4 },
  { type: 'KARA II', size: 3 },
  { type: 'KARA', size: 3 },
];
const auto = (n: number) => ({ cart_sizes: sizes, carts: Array.from({ length: n }, () => ({ manual: false, breaks: [] })) });

describe('migrate', () => {
  it('has a step for each earlier version: 1 to 2, 2 to 3, 3 to 4, 4 to 5, 5 to 6, 6 to 7, 7 to 8, 8 to 9, 9 to 10, and 10 to 11', () => {
    expect(Object.keys(MIGRATIONS)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });

  it('passes a current file through untouched', () => {
    const file = { format: 'arraysheet/11', x: 1 };
    expect(migrate(file)).toEqual(file);
  });

  it('upgrades a version 1 file by choosing every array for printing', () => {
    const v1 = { format: 'arraysheet/1', report: { sources: [{}, {}, {}] }, keep: 'me' };
    expect(migrate(v1, 2)).toEqual({ format: 'arraysheet/2', report: { sources: [{}, {}, {}] }, keep: 'me', print: [true, true, true] });
  });

  it('upgrades a damaged version 1 file without crashing, leaving the schema to say what is wrong', () => {
    expect(migrate({ format: 'arraysheet/1' })).toEqual({ format: 'arraysheet/11', print: [], titles: [], notes: [], deleted: [], markers: [], patch: [], underlay: null, ...auto(0) });
    expect(migrate({ format: 'arraysheet/1', report: null })).toMatchObject({ print: [] });
    expect(migrate({ format: 'arraysheet/1', report: { sources: 'many' } })).toMatchObject({ print: [] });
  });

  it('upgrades a version 2 file by adding a blank venue, and keeps what is there', () => {
    const none = { titles: [], notes: [], deleted: [], markers: [], patch: [], underlay: null, ...auto(0) };
    expect(migrate({ format: 'arraysheet/2', job: { show: 'A' } })).toEqual({ format: 'arraysheet/11', job: { show: 'A', venue: '', origin: '', side_labels: true, notes: '', show_date: '' }, ...none });
    expect(migrate({ format: 'arraysheet/2' })).toEqual({ format: 'arraysheet/11', ...none });
    expect(migrate({ format: 'arraysheet/2', job: null })).toEqual({ format: 'arraysheet/11', job: null, ...none });
  });

  it('upgrades a version 3 file by changing nothing but the format', () => {
    const rows = [{ number: 1, type: 'SB28' }];
    expect(migrate({ format: 'arraysheet/3', report: { sources: [{ cabinets: rows }] } })).toEqual({
      format: 'arraysheet/11',
      report: { sources: [{ cabinets: rows }] },
      titles: [''],
      notes: [''],
      deleted: [false],
      markers: [plain],
      patch: [[{ feeder: '', way: '' }]],
      underlay: null,
      ...auto(1),
    });
  });

  it('upgrades a version 4 file by changing nothing but the format', () => {
    const fixations = [{ name: 'Fr', at: { x: -2.84, y: 4.6, z: 1 } }];
    expect(migrate({ format: 'arraysheet/4', report: { sources: [{ fixations }] } })).toEqual({
      format: 'arraysheet/11',
      report: { sources: [{ fixations }] },
      titles: [''],
      notes: [''],
      deleted: [false],
      markers: [plain],
      patch: [[]],
      underlay: null,
      ...auto(1),
    });
  });

  it('upgrades a version 5 file by adding a blank origin and the side labels, and keeps what is there', () => {
    const none = { titles: [], notes: [], deleted: [], markers: [], patch: [], underlay: null, ...auto(0) };
    expect(migrate({ format: 'arraysheet/5', job: { show: 'A' } })).toEqual({ format: 'arraysheet/11', job: { show: 'A', origin: '', side_labels: true, notes: '', show_date: '' }, ...none });
    expect(migrate({ format: 'arraysheet/5', job: null })).toEqual({ format: 'arraysheet/11', job: null, ...none });
  });

  it('upgrades a version 6 file by giving every array a blank title and note and keeping it', () => {
    const report = { sources: [{ name: 'A' }, { name: 'B' }] };
    expect(migrate({ format: 'arraysheet/6', report, keep: 'me' })).toEqual({
      format: 'arraysheet/11',
      report,
      keep: 'me',
      titles: ['', ''],
      notes: ['', ''],
      deleted: [false, false],
      markers: [plain, plain],
      patch: [[], []],
      underlay: null,
      ...auto(2),
    });
    expect(migrate({ format: 'arraysheet/6' })).toEqual({ format: 'arraysheet/11', titles: [], notes: [], deleted: [], markers: [], patch: [], underlay: null, ...auto(0) });
    expect(migrate({ format: 'arraysheet/6', report: { sources: 'many' } })).toMatchObject({ titles: [], notes: [], deleted: [], markers: [] });
    expect(migrate({ format: 'arraysheet/6', job: { show: 'A' } })).toMatchObject({ job: { show: 'A', notes: '', show_date: '' } });
    expect(migrate({ format: 'arraysheet/6', job: null })).toMatchObject({ job: null });
  });

  it('upgrades a version 7 file by giving every pickup of every array the 1 ton symbol', () => {
    const report = { sources: [{ name: 'A' }, { name: 'B' }] };
    expect(migrate({ format: 'arraysheet/7', report, keep: 'me' })).toEqual({ format: 'arraysheet/11', report, keep: 'me', markers: [plain, plain], patch: [[], []], underlay: null, ...auto(2) });
    expect(migrate({ format: 'arraysheet/7' })).toEqual({ format: 'arraysheet/11', markers: [], patch: [], underlay: null, ...auto(0) });
    expect(migrate({ format: 'arraysheet/7', report: { sources: 'many' } })).toMatchObject({ markers: [] });
  });

  it('upgrades a version 8 file by giving it no venue, and keeps what is there', () => {
    expect(migrate({ format: 'arraysheet/8', keep: 'me' }, 9)).toEqual({ format: 'arraysheet/9', keep: 'me', underlay: null });
  });

  it('upgrades a version 9 file by giving every enclosure row of every array a blank feeder and way, and keeps what is there', () => {
    const blank = { feeder: '', way: '' };
    const report = { sources: [{ name: 'A', cabinets: [{}, {}, {}] }, { name: 'B', cabinets: [] }, { name: 'C' }] };
    expect(migrate({ format: 'arraysheet/9', report, keep: 'me' })).toEqual({ format: 'arraysheet/11', report, keep: 'me', patch: [[blank, blank, blank], [], []], ...auto(3) });
    expect(migrate({ format: 'arraysheet/9' })).toEqual({ format: 'arraysheet/11', patch: [], ...auto(0) });
    expect(migrate({ format: 'arraysheet/9', report: { sources: 'many' } })).toMatchObject({ patch: [] });
    expect(migrate({ format: 'arraysheet/9', report: { sources: [null, { cabinets: 'many' }] } })).toMatchObject({ patch: [[], []] });
  });

  it('upgrades a version 10 file by giving it the usual cart sizes and every array automatic, and keeps what is there', () => {
    const report = { sources: [{ name: 'A' }, { name: 'B' }] };
    expect(migrate({ format: 'arraysheet/10', report, keep: 'me' })).toEqual({ format: 'arraysheet/11', report, keep: 'me', ...auto(2) });
    expect(migrate({ format: 'arraysheet/10' })).toEqual({ format: 'arraysheet/11', ...auto(0) });
    expect(migrate({ format: 'arraysheet/10', report: { sources: 'many' } })).toMatchObject({ carts: [] });
  });

  it('upgrades a version 1 file all the way to the current version', () => {
    const out = migrate({ format: 'arraysheet/1', report: { sources: [{}] }, job: { show: 'A' } });
    expect(out).toEqual({
      format: 'arraysheet/11',
      report: { sources: [{}] },
      job: { show: 'A', venue: '', origin: '', side_labels: true, notes: '', show_date: '' },
      print: [true],
      titles: [''],
      notes: [''],
      deleted: [false],
      markers: [plain],
      patch: [[]],
      underlay: null,
      ...auto(1),
    });
  });

  it('refuses things that are not files', () => {
    for (const bad of [null, 5, 'text', [], {}, { format: 3 }, { format: 'loadsheet/1' }, { format: 'arraysheet/x' }]) {
      expect(() => migrate(bad)).toThrow(FileError);
    }
  });

  it('refuses a file from a newer version and says what to do', () => {
    expect(() => migrate({ format: 'arraysheet/12' })).toThrow(/newer version of RigPoint Array Sheet/);
  });

  it('runs each step in order, one version at a time', () => {
    const steps = {
      1: (f: Record<string, unknown>) => ({ ...f, a: 'one-to-two' }),
      2: (f: Record<string, unknown>) => ({ ...f, b: `${String(f['a'])}+two-to-three` }),
    };
    expect(migrate({ format: 'arraysheet/1' }, 3, steps)).toEqual({ format: 'arraysheet/3', a: 'one-to-two', b: 'one-to-two+two-to-three' });
    expect(migrate({ format: 'arraysheet/2' }, 3, steps)).toEqual({ format: 'arraysheet/3', a: undefined, b: 'undefined+two-to-three' });
  });

  it('says so when a step is missing', () => {
    expect(() => migrate({ format: 'arraysheet/1' }, 2, {})).toThrow(/version 1 and cannot be upgraded/);
  });
});
