import { describe, expect, it } from 'vitest';
import { FileError, migrate, MIGRATIONS } from './migrations';

describe('migrate', () => {
  it('has a step for each earlier version: 1 to 2, 2 to 3, and 3 to 4', () => {
    expect(Object.keys(MIGRATIONS)).toEqual(['1', '2', '3']);
  });

  it('passes a current file through untouched', () => {
    const file = { format: 'arraysheet/4', x: 1 };
    expect(migrate(file)).toEqual(file);
  });

  it('upgrades a version 1 file by choosing every array for printing', () => {
    const v1 = { format: 'arraysheet/1', report: { sources: [{}, {}, {}] }, keep: 'me' };
    expect(migrate(v1, 2)).toEqual({ format: 'arraysheet/2', report: { sources: [{}, {}, {}] }, keep: 'me', print: [true, true, true] });
  });

  it('upgrades a damaged version 1 file without crashing, leaving the schema to say what is wrong', () => {
    expect(migrate({ format: 'arraysheet/1' })).toEqual({ format: 'arraysheet/4', print: [] });
    expect(migrate({ format: 'arraysheet/1', report: null })).toMatchObject({ print: [] });
    expect(migrate({ format: 'arraysheet/1', report: { sources: 'many' } })).toMatchObject({ print: [] });
  });

  it('upgrades a version 2 file by adding a blank venue, and keeps what is there', () => {
    expect(migrate({ format: 'arraysheet/2', job: { show: 'A' } })).toEqual({ format: 'arraysheet/4', job: { show: 'A', venue: '' } });
    expect(migrate({ format: 'arraysheet/2' })).toEqual({ format: 'arraysheet/4' });
    expect(migrate({ format: 'arraysheet/2', job: null })).toEqual({ format: 'arraysheet/4', job: null });
  });

  it('upgrades a version 3 file by changing nothing but the format', () => {
    const rows = [{ number: 1, type: 'SB28' }];
    expect(migrate({ format: 'arraysheet/3', report: { sources: [{ cabinets: rows }] } })).toEqual({
      format: 'arraysheet/4',
      report: { sources: [{ cabinets: rows }] },
    });
  });

  it('upgrades a version 1 file all the way to the current version', () => {
    const out = migrate({ format: 'arraysheet/1', report: { sources: [{}] }, job: { show: 'A' } });
    expect(out).toEqual({ format: 'arraysheet/4', report: { sources: [{}] }, job: { show: 'A', venue: '' }, print: [true] });
  });

  it('refuses things that are not files', () => {
    for (const bad of [null, 5, 'text', [], {}, { format: 3 }, { format: 'loadsheet/1' }, { format: 'arraysheet/x' }]) {
      expect(() => migrate(bad)).toThrow(FileError);
    }
  });

  it('refuses a file from a newer version and says what to do', () => {
    expect(() => migrate({ format: 'arraysheet/5' })).toThrow(/newer version of RigPoint Array/);
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
