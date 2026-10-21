import { describe, expect, it } from 'vitest';
import { suggestedFileName, safeName } from './file-name';
import { cleanRevision, nextRevision, REVISION_PATTERN } from './revision';

describe('nextRevision', () => {
  it.each([
    ['', 'A'], ['A', 'B'], ['B', 'C'], ['Y', 'Z'], ['Z', 'AA'], ['AA', 'AB'], ['AZ', 'BA'], ['ZZ', 'AAA'],
  ])('%j comes after to %j', (from, to) => expect(nextRevision(from)).toBe(to));

  it('property: always moves forward and stays capitals', () => {
    let r = '';
    const seen = new Set<string>();
    for (let i = 0; i < 800; i++) {
      r = nextRevision(r);
      expect(r).toMatch(/^[A-Z]+$/);
      expect(seen.has(r)).toBe(false);
      seen.add(r);
    }
  });

  it('every revision up to ZZ is a valid one', () => {
    let r = '';
    for (let i = 0; i < 26 + 26 * 26; i++) {
      r = nextRevision(r);
      expect(REVISION_PATTERN.test(r)).toBe(true);
    }
    expect(REVISION_PATTERN.test(nextRevision(r))).toBe(false);
  });
});

describe('cleanRevision', () => {
  it.each([['b', 'B'], ['ab', 'AB'], ['a1!', 'A'], ['abc', 'AB'], ['', ''], [' c ', 'C']])('%j becomes %j', (typed, clean) =>
    expect(cleanRevision(typed)).toBe(clean),
  );
});

describe('file names', () => {
  it('leaves the first issue without a revision suffix', () => {
    expect(suggestedFileName('Main stage', '')).toBe('Main stage.arraysheet.json');
  });

  it('adds the revision, as the family does', () => {
    expect(suggestedFileName('Main stage', 'B')).toBe('Main stage - Rev B.arraysheet.json');
  });

  it('drops the Soundvision file extension', () => {
    expect(suggestedFileName('Example Arena - Example Show.xmlp', '')).toBe('Example Arena - Example Show.arraysheet.json');
  });

  it('removes characters a file system would refuse', () => {
    expect(safeName('A/B\\C:D*E?F"G<H>I|J')).toBe('A B C D E F G H I J');
    expect(safeName('  ..hidden.. ')).toBe('hidden');
    expect(safeName('tab\there')).toBe('tab here');
  });

  it('never returns an empty name, and keeps names short', () => {
    expect(safeName('///')).toBe('Array sheet');
    expect(safeName('')).toBe('Array sheet');
    expect(safeName('x'.repeat(500)).length).toBe(80);
  });
});
