/* eslint-disable @typescript-eslint/no-explicit-any -- these tests poke arbitrary JSON into a saved file */
import { describe, expect, it } from 'vitest';
import { parseVenue, type Underlay } from '../engine/underlay';
import { parseFixture } from '../testing/fixtures';
import { openFileText, serialiseDoc } from './array-file-io';
import { editKey, isDirty, newDoc, updatedDoc, withLayerHidden, withUnderlay, type Doc } from './doc';
import { FileError } from './migrations';

const NOW = new Date('2026-10-22T10:30:00.000Z');

const TEXT = [
  '"; LengthUnit","m"',
  '"Label","Floor 01"',
  '0,0,0',
  '40,0,0',
  '40,30,0',
  '0,30,0',
  '";"',
  '"Label","Roof 01"',
  '0,0,12',
  '40,30,12',
  '";"',
].join('\n');

function venue(): Underlay {
  const r = parseVenue(TEXT);
  if (!r.ok) throw new Error(r.message);
  return r.underlay;
}

function withVenue(): Doc {
  return withUnderlay(newDoc(parseFixture('a'), 'a.pdf'), venue());
}

const roundTrip = (doc: Doc) => openFileText(serialiseDoc(doc, '0.1.0', NOW), 'v.arraysheet.json');

function edited(doc: Doc, change: (f: Record<string, any>) => void): string {
  const f = JSON.parse(serialiseDoc(doc, '0.1.0', NOW)) as Record<string, any>;
  change(f);
  return JSON.stringify(f);
}

describe('the venue underlay in a saved file', () => {
  it('is saved as packed text, not as a list of numbers, and opens again as it was', () => {
    const doc = withVenue();
    const text = serialiseDoc(doc, '0.1.0', NOW);
    const saved = JSON.parse(text);
    expect(saved.format).toBe('arraysheet/10');
    expect(typeof saved.underlay.layers[0].shades[0].edges).toBe('string');
    expect(roundTrip(doc).doc.underlay).toEqual(doc.underlay);
  });

  it('is null when there is no venue, and opens as none', () => {
    const doc = newDoc(parseFixture('a'), 'a.pdf');
    expect(JSON.parse(serialiseDoc(doc, '0.1.0', NOW)).underlay).toBeNull();
    expect(roundTrip(doc).doc.underlay).toBeNull();
  });

  it('keeps which layers are switched off', () => {
    const doc = withLayerHidden(withVenue(), 'Roof', true);
    const opened = roundTrip(doc).doc;
    expect(opened.underlay?.layers.map((l) => [l.name, l.hidden])).toEqual([['Floor', false], ['Roof', true]]);
  });

  it('counts as an edit to import, hide a layer or remove the venue', () => {
    const plain = newDoc(parseFixture('a'), 'a.pdf');
    const imported = withUnderlay(plain, venue());
    const hidden = withLayerHidden(imported, 'Roof', true);
    const removed = withUnderlay(hidden, null);
    expect(new Set([editKey(plain), editKey(imported), editKey(hidden)]).size).toBe(3);
    expect(editKey(removed)).toBe(editKey(plain));
    const saved = roundTrip(imported).doc;
    expect(isDirty(saved)).toBe(false);
    expect(isDirty(withLayerHidden(saved, 'Floor', true))).toBe(true);
  });

  it('cannot be imported, hidden or removed in a read-only file', () => {
    const doc = { ...withVenue(), locked: true };
    expect(withUnderlay(doc, null)).toBe(doc);
    expect(withLayerHidden(doc, 'Roof', true)).toBe(doc);
    expect(withUnderlay({ ...newDoc(parseFixture('a'), 'a.pdf'), locked: true }, venue()).underlay).toBeNull();
  });

  it('stays with the document when it is updated from a new PDF', () => {
    const doc = withLayerHidden(withVenue(), 'Roof', true);
    const updated = updatedDoc(doc, parseFixture('a'), 'a2.pdf');
    expect(updated.underlay).toEqual(doc.underlay);
  });

  it('starts every layer on when a venue is replaced', () => {
    const hidden = withLayerHidden(withVenue(), 'Floor', true);
    const replaced = withUnderlay(hidden, venue());
    expect(replaced.underlay?.layers.every((l) => !l.hidden)).toBe(true);
  });

  it('is refused when the packed lines are not ones this app wrote', () => {
    expect(() => openFileText(edited(withVenue(), (f) => (f.underlay.layers[0].shades[0].edges = '<b>,1')), null)).toThrow(/venue lines could not be read/);
  });

  it('is refused when a shade, a name or a layer is wrong', () => {
    expect(() => openFileText(edited(withVenue(), (f) => (f.underlay.layers[0].shades[0].step = 9)), null)).toThrow(/out of range/);
    expect(() => openFileText(edited(withVenue(), (f) => (f.underlay.layers[0].name = '')), null)).toThrow(/needs a name/);
    expect(() => openFileText(edited(withVenue(), (f) => (f.underlay.layers[0].hidden = 'yes')), null)).toThrow(FileError);
    expect(() => openFileText(edited(withVenue(), (f) => (f.underlay = { layers: 'many' })), null)).toThrow(FileError);
  });

  it('is refused when the lines are more than the limit', () => {
    const many = Array.from({ length: 60001 }, () => '1,1').join(' ');
    expect(() => openFileText(edited(withVenue(), (f) => (f.underlay.layers[0].shades[0].edges = `0,0,0,0 ${many}`)), null)).toThrow(/more than 60000 lines/);
  });

  it('opens a version 8 file as a file with no venue', () => {
    const v8 = JSON.parse(serialiseDoc(newDoc(parseFixture('a'), 'a.pdf'), '0.1.0', NOW)) as Record<string, any>;
    v8['format'] = 'arraysheet/8';
    delete v8['underlay'];
    expect(openFileText(JSON.stringify(v8), null).doc.underlay).toBeNull();
  });
});
