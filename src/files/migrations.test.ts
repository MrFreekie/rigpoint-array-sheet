import { describe, expect, it } from 'vitest';
import { FileError, migrate, MIGRATIONS } from './migrations';

describe('migrate', () => {
  it('has no steps yet, because version 1 is the first', () => {
    expect(Object.keys(MIGRATIONS)).toEqual([]);
  });

  it('passes a current file through untouched', () => {
    const file = { format: 'arraysheet/1', x: 1 };
    expect(migrate(file)).toEqual(file);
  });

  it('refuses things that are not files', () => {
    for (const bad of [null, 5, 'text', [], {}, { format: 3 }, { format: 'loadsheet/1' }, { format: 'arraysheet/x' }]) {
      expect(() => migrate(bad)).toThrow(FileError);
    }
  });

  it('refuses a file from a newer version and says what to do', () => {
    expect(() => migrate({ format: 'arraysheet/2' })).toThrow(/newer version of RigPoint Array/);
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
