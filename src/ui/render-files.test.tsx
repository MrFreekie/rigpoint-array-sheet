import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Change } from '../engine/compare';
import { ORIGIN_MAX } from '../schema/array-file';
import { parseFixture } from '../testing/fixtures';
import { CompareDialog } from './CompareDialog';
import { newDoc } from './document';
import { JobForm } from './JobForm';

const doc = () => newDoc(parseFixture('a'), 'a.pdf');
const noop = () => {};

describe('JobForm origin', () => {
  it('has an Origin (P0) field with the typed note', () => {
    const d = doc();
    d.job.origin = 'Iron Line';
    const html = renderToStaticMarkup(<JobForm doc={d} locked={false} onJob={noop} onStatus={noop} onRevision={noop} />);
    expect(html).toContain('Origin (P0)');
    expect(html).toContain('value="Iron Line"');
    expect(html).toContain(`maxLength="${ORIGIN_MAX}"`);
  });
});

describe('JobForm status and revision', () => {
  it('offers every status and explains the lock', () => {
    const html = renderToStaticMarkup(<JobForm doc={doc()} locked={false} onJob={noop} onStatus={noop} onRevision={noop} />);
    for (const label of ['Draft', 'Issued', 'Approved', 'Superseded']) expect(html).toContain(`>${label}</option>`);
    expect(html).toContain('Approved and superseded files are read-only.');
    expect(html).toContain('Blank for the first issue, then A, B, C.');
    expect(html).not.toContain('disabled');
  });

  it('disables every field of a locked file', () => {
    const html = renderToStaticMarkup(<JobForm doc={doc()} locked onJob={noop} onStatus={noop} onRevision={noop} />);
    expect(html.match(/disabled=""/g)).toHaveLength(10);
  });

  it('shows the revision that was typed', () => {
    const d = doc();
    d.revision = 'B';
    expect(renderToStaticMarkup(<JobForm doc={d} locked={false} onJob={noop} onStatus={noop} onRevision={noop} />)).toContain('value="B"');
  });
});

describe('CompareDialog', () => {
  const changes: Change[] = [
    { kind: 'changed', array: 'KARA II L Main', what: 'Total weight', saved: '414.2', now: '420' },
    { kind: 'added', array: 'New array', what: 'Array', saved: null, now: 'in the new PDF' },
    { kind: 'removed', array: 'Old array', what: 'Array', saved: 'in the saved file', now: null },
    { kind: 'changed', array: null, what: 'Report date', saved: '2026/10/21', now: '2026/10/22' },
  ];
  const html = renderToStaticMarkup(<CompareDialog changes={changes} sourceName="new.pdf" onUpdate={noop} onKeep={noop} />);

  it('says what differs, with a word for each kind of change', () => {
    expect(html).toContain('new.pdf differs from this file in 4 places');
    for (const word of ['CHANGED', 'ADDED', 'REMOVED']) expect(html).toContain(word);
    expect(html).toContain('KARA II L Main: ');
    expect(html).toContain('was <q>414.2</q>, now <q>420</q>');
  });

  it('offers to update or keep as saved', () => {
    expect(html).toContain('Update from new PDF');
    expect(html).toContain('Keep as saved');
  });

  it('says it keeps what was typed', () => {
    expect(html).toContain('Your show details and ground offsets are kept');
  });

  it('lists at most 60 differences and says how many more', () => {
    const many: Change[] = Array.from({ length: 75 }, (_, i) => ({ kind: 'changed', array: 'A', what: `Item ${i}`, saved: '1', now: '2' }));
    const big = renderToStaticMarkup(<CompareDialog changes={many} sourceName="n.pdf" onUpdate={noop} onKeep={noop} />);
    expect(big.match(/<li>/g)).toHaveLength(60);
    expect(big).toContain('and 15 more');
  });
});
