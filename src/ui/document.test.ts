import { describe, expect, it } from 'vitest';
import { editKey, isDirty, isLocked, isPrinted, STATUSES, statusLocks, withPrinted } from '../files/doc';
import { parseFixture } from '../testing/fixtures';
import { effectiveOffset, newDoc, showTitle } from './document';

const fresh = () => newDoc(parseFixture('a'), 'a.pdf');

describe('effectiveOffset', () => {
  it('is 0 when nothing is typed', () => {
    expect(effectiveOffset(fresh(), 0)).toEqual({ value: 0, badField: null });
  });

  it('uses the default when the array has none of its own', () => {
    const doc = fresh();
    doc.job.defaultOffset = '0.3';
    expect(effectiveOffset(doc, 4).value).toBe(0.3);
  });

  it('prefers the array own value', () => {
    const doc = fresh();
    doc.job.defaultOffset = '0.3';
    doc.offsets[1] = '1.5';
    expect(effectiveOffset(doc, 1).value).toBe(1.5);
    expect(effectiveOffset(doc, 0).value).toBe(0.3);
  });

  it('says which field is wrong', () => {
    const doc = fresh();
    doc.job.defaultOffset = 'x';
    doc.offsets[2] = 'y';
    expect(effectiveOffset(doc, 0)).toEqual({ value: null, badField: 'default' });
    expect(effectiveOffset(doc, 2)).toEqual({ value: null, badField: 'array' });
  });
});

describe('effectiveOffset with a mirrored array', () => {
  it('uses the mirror offset when the array has none of its own', () => {
    const doc = fresh();
    doc.job.defaultOffset = '0.3';
    doc.offsets[0] = '1.5';
    expect(effectiveOffset(doc, 1, 0).value).toBe(1.5);
    expect(effectiveOffset(doc, 1).value).toBe(0.3);
  });

  it('prefers its own over the mirror', () => {
    const doc = fresh();
    doc.offsets[0] = '1.5';
    doc.offsets[1] = '2';
    expect(effectiveOffset(doc, 1, 0).value).toBe(2);
  });

  it('flags a bad mirror offset as the array own field', () => {
    const doc = fresh();
    doc.offsets[0] = 'x';
    expect(effectiveOffset(doc, 1, 0)).toEqual({ value: null, badField: 'array' });
  });
});

describe('dirty and locked', () => {
  it('a document that was never saved is unsaved', () => {
    expect(isDirty(fresh())).toBe(true);
  });

  it('is clean after saving, dirty after any change, clean again if the change is undone', () => {
    const doc = fresh();
    doc.savedKey = editKey(doc);
    expect(isDirty(doc)).toBe(false);
    doc.job.company = 'Acme';
    expect(isDirty(doc)).toBe(true);
    doc.job.company = '';
    expect(isDirty(doc)).toBe(false);
  });

  it('ignores a blank ground offset but notices a typed one', () => {
    const doc = fresh();
    doc.savedKey = editKey(doc);
    doc.offsets[3] = '  ';
    expect(isDirty(doc)).toBe(false);
    doc.offsets[3] = '0.2';
    expect(isDirty(doc)).toBe(true);
  });

  it('notices a change of status or revision', () => {
    const doc = fresh();
    doc.savedKey = editKey(doc);
    doc.revision = 'A';
    expect(isDirty(doc)).toBe(true);
  });

  it('is locked only when the file was opened or saved as approved or superseded', () => {
    const doc = fresh();
    expect(isLocked(doc)).toBe(false);
    doc.status = 'approved';
    expect(isLocked(doc)).toBe(false);
    doc.locked = true;
    expect(isLocked(doc)).toBe(true);
  });

  it('which statuses lock', () => {
    expect(STATUSES.filter(statusLocks)).toEqual(['approved', 'superseded']);
  });
});

describe('showTitle', () => {
  it('titles the show by name, then by report file name', () => {
    const doc = fresh();
    expect(showTitle(doc)).toBe('Example Arena - Example Show.xmlp');
    doc.job.show = 'Main stage';
    expect(showTitle(doc)).toBe('Main stage');
  });
});

describe('which arrays are chosen for printing', () => {
  it('every array is chosen to begin with', () => {
    const doc = fresh();
    expect(isPrinted(doc, 0)).toBe(true);
    expect(isPrinted(doc, 17)).toBe(true);
  });

  it('unchoosing one array leaves the others, and the choice can be undone', () => {
    const doc = withPrinted(fresh(), 3, false);
    expect(isPrinted(doc, 3)).toBe(false);
    expect(isPrinted(doc, 2)).toBe(true);
    expect(isPrinted(withPrinted(doc, 3, true), 3)).toBe(true);
  });

  it('counts as a change to save', () => {
    const doc = fresh();
    doc.savedKey = editKey(doc);
    const changed = withPrinted(doc, 1, false);
    expect(isDirty(changed)).toBe(true);
    expect(isDirty(withPrinted(changed, 1, true))).toBe(false);
  });

  it('a read-only file keeps the choice for this session only: nothing to save', () => {
    const doc = fresh();
    doc.locked = true;
    doc.savedKey = editKey(doc);
    const changed = withPrinted(doc, 1, false);
    expect(isPrinted(changed, 1)).toBe(false);
    expect(changed.noPrint).toEqual({});
    expect(isDirty(changed)).toBe(false);
    // Later changes build on the choices already made.
    expect(isPrinted(withPrinted(changed, 2, false), 1)).toBe(false);
  });
});
