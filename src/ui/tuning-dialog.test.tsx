import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { newDoc, type Doc } from './document';
import { TuningDialog } from './TuningDialog';

const noop = () => {};
const docOf = (): Doc => newDoc(parseFixture('a'), 'a.pdf');
const html = (d: Doc, locked = false, busy = false) => renderToStaticMarkup(<TuningDialog doc={d} locked={locked} busy={busy} onPdf={noop} onImage={noop} onClose={noop} />);
const withoutTuning = (): Doc => {
  const d = docOf();
  for (const s of d.result.report.sources) delete s.tuning;
  return d;
};

describe('Tuning sheet', () => {
  it('is a table of the arrays with the six columns, the figures and the footnote', () => {
    const out = html(docOf());
    expect(out).toContain('>Tuning sheet</h2>');
    for (const heading of ['Array', 'Delay', 'Gain', 'Autofilter', 'LF Contour', 'Zoom']) expect(out).toContain(`scope="col">${heading}</th>`);
    expect(out).toContain('KARA II L Main');
    expect(out).toContain('180 Hz, 2 dB');
    expect(out).toContain('<div>4.17 ms</div><div class="tuning-small">SUBS: 4 ms</div>');
    expect(out).toContain('A blank means the report states nothing the app could read for it.');
    expect(out.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr>/g)).toHaveLength(18);
  });

  it('says a file saved before tuning was read has none, and how to get it, and offers no downloads', () => {
    const out = html(withoutTuning());
    expect(out).toContain('This file was saved before the app read tuning values. Use Update from PDF with the same report to read them. Update from PDF also brings back any array you deleted.');
    expect(out).not.toContain('<table');
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Download PDF/);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Save image/);
  });

  it('asks for a new revision first on a read-only file', () => {
    expect(html(withoutTuning(), true)).toContain('Create a new revision, then use Update from PDF');
  });

  it('shows the same table on a read-only file, with the downloads on, and has no field to type in', () => {
    const out = html(docOf(), true);
    expect(out).toContain('KARA II L Main');
    expect(out).not.toMatch(/<input|<textarea|<select/);
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>Download PDF/);
  });
});
