// Carts in the document and in the saved file: sizes for each type, hand cut breaks, and what a file may hold.

import { describe, expect, it } from 'vitest';
import { defaultCartSizes } from '../engine/carts';
import { withCartSize } from '../testing/carts';
import { parseFixture } from '../testing/fixtures';
import { docToFile, openFileText, serialiseDoc } from './array-file-io';
import {
  cartsOf,
  editKey,
  newDoc,
  updatedDoc,
  withCartBreak,
  withCartReset,
  withCartSizes,
  type Doc,
} from './doc';
import { FileError } from './migrations';

const NOW = new Date('2026-10-23T12:00:00Z');
const a = (): Doc => newDoc(parseFixture('a'), 'a.pdf');
const c = (): Doc => newDoc(parseFixture('c'), 'c.pdf');
const indexOf = (doc: Doc, name: string) => doc.result.report.sources.findIndex((s) => s.name === name);
const roundTrip = (doc: Doc): Doc => openFileText(serialiseDoc(doc, '0.1.0', NOW), 'x.arraysheet.json').doc;
const edited = (doc: Doc, change: (f: Record<string, unknown>) => void): string => {
  const f = JSON.parse(serialiseDoc(doc, '0.1.0', NOW)) as Record<string, unknown>;
  change(f);
  return JSON.stringify(f);
};

describe('the carts of an array', () => {
  it('are cut from the sizes of a new file: KARA II three to a cart and K2 four', () => {
    const doc = a();
    const main = cartsOf(doc, indexOf(doc, 'KARA II L Main'));
    expect(main).toMatchObject({ breaks: [3, 6, 9, 12], manual: false, groups: [3, 3, 3, 3, 3], forced: [] });
    const k2 = c();
    expect(cartsOf(k2, indexOf(k2, 'K2 Left')).groups).toEqual([4, 4, 4]);
  });

  it('start from the bottom for a stack, so the short cart is at the top', () => {
    const doc = c();
    // Three KS28 and KS28_C rows: the type changes once, so there is a forced break and nothing else.
    const ks = cartsOf(doc, indexOf(doc, 'KS28 1'));
    expect(ks.groups.reduce((n, g) => n + g, 0)).toBe(3);
    const withSizes = withCartSizes(doc, [{ type: 'KS28', size: 2 }, { type: 'KS28_C', size: 2 }]);
    expect(cartsOf(withSizes, indexOf(withSizes, 'KS28 1')).forced.length).toBeGreaterThan(0);
  });

  it('leave a type with no size whole', () => {
    const doc = withCartSizes(a(), []);
    expect(cartsOf(doc, indexOf(doc, 'KARA II L Main')).groups).toEqual([15]);
  });

  it('become hand cut when one break is clicked, and keep the other breaks as they were', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    const edit = withCartBreak(doc, i, 4);
    expect(cartsOf(edit, i)).toMatchObject({ manual: true, breaks: [3, 4, 6, 9, 12] });
    expect(cartsOf(withCartBreak(edit, i, 4), i).breaks).toEqual([3, 6, 9, 12]);
  });

  it('are cut to one size by a size button, and the array becomes hand cut', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    expect(cartsOf(withCartSize(doc, i, 4), i)).toMatchObject({ manual: true, groups: [4, 4, 4, 3] });
    expect(cartsOf(withCartSize(doc, i, 6), i).groups).toEqual([6, 6, 3]);
  });

  it('go back to automatic on Reset, and follow a changed size table again', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    const reset = withCartReset(withCartSize(doc, i, 4), i);
    expect(cartsOf(reset, i).manual).toBe(false);
    expect(reset.carts).toEqual({});
    expect(cartsOf(withCartSizes(reset, [{ type: 'KARA II', size: 5 }]), i).groups).toEqual([5, 5, 5]);
  });

  it('cannot be changed in a read-only file', () => {
    const doc = { ...a(), locked: true };
    const i = indexOf(doc, 'KARA II L Main');
    expect(withCartBreak(doc, i, 4)).toBe(doc);
    expect(withCartSize(doc, i, 4)).toBe(doc);
    expect(withCartReset({ ...doc, carts: { [i]: [4] } }, i).carts).toEqual({ [i]: [4] });
    expect(withCartSizes(doc, [])).toBe(doc);
  });

  it('ignore a break outside the table', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    expect(withCartBreak(doc, i, 0)).toBe(doc);
    expect(withCartBreak(doc, i, 15)).toBe(doc);
  });

  it('change the key that says the file has unsaved changes, for the sizes and for a hand cut array', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    expect(editKey(withCartBreak(doc, i, 4))).not.toBe(editKey(doc));
    expect(editKey(withCartSizes(doc, [{ type: 'K2', size: 2 }]))).not.toBe(editKey(doc));
    expect(editKey(withCartReset(withCartBreak(doc, i, 4), i))).toBe(editKey(doc));
  });
});

describe('carts in a saved file', () => {
  it('are saved as the sizes and one entry for each array: automatic holds no breaks, a hand cut array holds its own', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    const file = docToFile(withCartBreak(doc, i, 4), '0.1.0', NOW);
    expect(file.format).toBe('arraysheet/12');
    expect(file.cart_sizes).toEqual(defaultCartSizes());
    expect(file.carts).toHaveLength(doc.result.report.sources.length);
    expect(file.carts[i]).toEqual({ manual: true, breaks: [3, 4, 6, 9, 12] });
    expect(file.carts.filter((x) => x.manual)).toHaveLength(1);
    expect(file.carts[0 === i ? 1 : 0]).toEqual({ manual: false, breaks: [] });
  });

  it('open again as they were, the sizes and the hand cut arrays', () => {
    const doc = withCartSizes(withCartSize(a(), 2, 4), [{ type: 'KARA II', size: 5 }, { type: 'SB28', size: 2 }]);
    const back = roundTrip(doc);
    expect(back.carts).toEqual(doc.carts);
    expect(back.cartSizes).toEqual(doc.cartSizes);
    expect(back.savedKey).toBe(editKey(back));
  });

  it('keep a hand cut array that is cut like the automatic one, because the person did choose it', () => {
    const doc = a();
    const i = indexOf(doc, 'KARA II L Main');
    const same = withCartSize(doc, i, 3);
    expect(roundTrip(same).carts[i]).toEqual([3, 6, 9, 12]);
  });

  it('refuse a size that is not a whole number from 1 to 24', () => {
    for (const bad of [0, 25, 2.5, -1, '3']) {
      const text = edited(a(), (f) => ((f['cart_sizes'] as unknown[]).push({ type: 'X', size: bad })));
      expect(() => openFileText(text, null)).toThrow(FileError);
    }
  });

  it('refuse a type that is blank, holds a control character, or is listed twice ignoring case', () => {
    for (const types of [['  '], ['K\u0007'], ['K2', 'k2 ']]) {
      const text = edited(a(), (f) => {
        f['cart_sizes'] = types.map((type) => ({ type, size: 3 }));
      });
      expect(() => openFileText(text, null)).toThrow(/cart size/i);
    }
  });

  it('refuse more than 100 sizes', () => {
    const text = edited(a(), (f) => {
      f['cart_sizes'] = Array.from({ length: 101 }, (_, i) => ({ type: `T${i}`, size: 3 }));
    });
    expect(() => openFileText(text, null)).toThrow(/more than 100 cart sizes/);
  });

  it('refuse breaks that are outside the table, repeated, out of order, or listed for an automatic array', () => {
    const i = 0;
    const set = (carts: unknown) => edited(a(), (f) => ((f['carts'] as unknown[])[i] = carts));
    expect(() => openFileText(set({ manual: true, breaks: [0] }), null)).toThrow(/must fall between/);
    expect(() => openFileText(set({ manual: true, breaks: [15] }), null)).toThrow(/must fall between/);
    expect(() => openFileText(set({ manual: true, breaks: [3, 3] }), null)).toThrow(/once each/);
    expect(() => openFileText(set({ manual: true, breaks: [6, 3] }), null)).toThrow(/once each/);
    expect(() => openFileText(set({ manual: true, breaks: [1.5] }), null)).toThrow(FileError);
    expect(() => openFileText(set({ manual: false, breaks: [3] }), null)).toThrow(/automatic/);
    expect(() => openFileText(set({ manual: true, breaks: [3, 6] }), null)).not.toThrow();
  });

  it('refuse a list that does not have one entry for each array', () => {
    const text = edited(a(), (f) => (f['carts'] as unknown[]).pop());
    expect(() => openFileText(text, null)).toThrow(/one set of carts for each array/);
  });
});

describe('carts and Update from PDF', () => {
  it('keep a hand cut array with the array of the same name, and leave the sizes alone', () => {
    const doc = withCartSizes(withCartSize(a(), 0, 4), [{ type: 'KARA II', size: 5 }]);
    const updated = updatedDoc(doc, parseFixture('a'), 'a2.pdf');
    expect(updated.carts).toEqual({ 0: [4, 8, 12] });
    expect(updated.cartSizes).toEqual([{ type: 'KARA II', size: 5 }]);
  });

  it('return an array to automatic when the new PDF has other enclosures in it', () => {
    const doc = withCartSize(a(), 0, 4);
    // Report B also has an array of KARA II, but its names and rows differ, so nothing matches by name and row count.
    const updated = updatedDoc(doc, parseFixture('b'), 'b.pdf');
    expect(updated.carts).toEqual({});
  });
});
