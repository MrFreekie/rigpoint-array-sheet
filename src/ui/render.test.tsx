// Renders components to HTML on the server and checks what a person would read.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { flySheetColumn, riggingRows } from '../engine/sheet';
import type { Problem } from '../engine/types';
import { parseFixture } from '../testing/fixtures';
import { App } from './App';
import { ArrayCard } from './ArrayCard';
import { ProblemsPanel } from './ProblemsPanel';
import { RiggingSummary } from './RiggingSummary';

const a = parseFixture('a').report.sources;
const b = parseFixture('b').report.sources;
const byName = (list: typeof a, name: string) => list.find((s) => s.name === name)!;

const card = (name: string, list = a, extra: Partial<Parameters<typeof ArrayCard>[0]> = {}) =>
  renderToStaticMarkup(
    <ArrayCard column={flySheetColumn(byName(list, name))} offsetText="" offsetBad={false} defaultBad={false} usingDefault onOffset={() => {}} printed onPrinted={() => {}} {...extra} />,
  );

describe('ArrayCard', () => {
  it('shows a flown array as the report states it', () => {
    const html = card('KARA II L Main');
    expect(html).toContain('KARA II L Main');
    expect(html).toContain('MAINS');
    expect(html).toContain('414.2 kg');
    expect(html).toContain('M-BUMP+MBAR hole A');
    expect(html).toContain('Front 6');
    expect(html).toContain('90 On');
    expect(html).not.toContain('Rear motor load');
  });

  it('shows both motor loads for a two-motor array', () => {
    const html = card('FL KARA II L', b);
    expect(html).toContain('182.7 kg');
    expect(html).toContain('52.7 kg');
    expect(html).toContain('Front 16, Rear 0');
  });

  it('puts a word on every Soundvision warning', () => {
    const html = card('SB28 L Front');
    expect(html).toContain('WARNING');
    expect(html).toContain('CAUTION');
    expect(html).toContain('Tipping hazard');
    expect(html).toContain('L-Acoustics recommends securing the array to the ground.');
  });

  it('leaves out the Angle and Panflex columns when the report has none', () => {
    const html = card('X8 2');
    expect(html).not.toContain('>Angle<');
    expect(html).not.toContain('>Panflex<');
  });

  it('lists a stack in report order, top first', () => {
    const html = card('GS KARA II L', b);
    expect(html.indexOf('<th scope="row">6</th>')).toBeLessThan(html.indexOf('<th scope="row">1</th>'));
  });

  it('explains a bad own offset, and a bad shared offset', () => {
    expect(card('X8 2', a, { offsetText: 'x', offsetBad: true })).toContain('The heights are hidden until you do');
    expect(card('X8 2', a, { defaultBad: true })).toContain('the ground offset for every array is not a number');
    expect(card('X8 2')).not.toContain('field-error');
  });

  it('says which array it also covers, and which array it mirrors', () => {
    const covers = card('KARA II L Main', a, { coversMirror: 'KARA II R Main' });
    expect(covers).toContain('MIRRORED');
    expect(covers).toContain('KARA II R Main');
    expect(covers).toContain('not shown separately');
    const mirror = card('KARA II R Main', a, { mirrorOf: 'KARA II L Main' });
    expect(mirror).toContain('An exact left-right mirror of');
    expect(card('KARA II L Main')).not.toContain('MIRRORED');
  });

  it('has a print checkbox, ticked when the array is chosen', () => {
    expect(card('X8 2')).toMatch(/<input type="checkbox" checked=""[^>]*\/><span>Print this array<\/span>/);
    const off = card('X8 2', a, { printed: false });
    expect(off).toContain('Print this array');
    expect(off).not.toMatch(/checked=""[^>]*\/><span>Print this array/);
  });

  it('labels the offset field', () => {
    expect(card('X8 2')).toContain('Ground offset (m)');
  });
});

describe('ProblemsPanel', () => {
  it('says READ OK in words when nothing was found', () => {
    const html = renderToStaticMarkup(<ProblemsPanel problems={[]} ok />);
    expect(html).toContain('READ OK');
    expect(html).toContain('This does not check the design');
  });

  it('lists checks with the array name and the word CHECK', () => {
    const problems: Problem[] = [{ level: 'check', source: 'KARA II L Main', message: 'A line was not understood.' }];
    const html = renderToStaticMarkup(<ProblemsPanel problems={problems} ok />);
    expect(html).toContain('1 thing to check against the PDF');
    expect(html).toContain('CHECK');
    expect(html).toContain('KARA II L Main: ');
    expect(html).toContain('role="status"');
  });

  it('is an alert and says the sheet is not shown when there is an error', () => {
    const problems: Problem[] = [
      { level: 'check', source: null, message: 'Minor.' },
      { level: 'error', source: null, message: 'Units are wrong.' },
    ];
    const html = renderToStaticMarkup(<ProblemsPanel problems={problems} ok={false} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('This report cannot be relied on');
    expect(html).toContain('The sheet is not shown');
    expect(html.indexOf('ERROR')).toBeLessThan(html.indexOf('CHECK'));
  });
});

describe('RiggingSummary', () => {
  it('lists each pickup with its position and load', () => {
    const html = renderToStaticMarkup(<RiggingSummary rows={riggingRows(b)} />);
    expect(html).toContain('FL KARA II L');
    expect(html).toContain('>Front<');
    expect(html).toContain('>Rear<');
    expect(html).toContain('182.7');
    expect(html).toContain('3.08');
  });

  it('says so when there is nothing to list', () => {
    expect(renderToStaticMarkup(<RiggingSummary rows={[]} />)).toContain('No flown array in this report has a pickup position');
  });
});

describe('App', () => {
  it('starts on the open-a-report screen and promises nothing it does not do', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Open a Soundvision report');
    expect(html).toContain('does not calculate loads or check that a rig is safe');
    expect(html).toContain('Nothing is uploaded');
  });
});
