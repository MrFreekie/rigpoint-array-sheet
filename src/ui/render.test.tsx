// Renders components to HTML on the server and checks what a person would read.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { flySheetColumn, riggingFixations, riggingNote, riggingRows } from '../engine/sheet';
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
  it('labels the rows of a stack laid out in columns', () => {
    const html = card('SB28 L', parseFixture('d').report.sources);
    expect(html).toContain('Col #');
    expect(html).toContain('C1 #1');
    expect(html).toContain('C2 #1');
  });

  it('shows the fixations of a stacked array as the report prints them, under the facts', () => {
    const html = card('KARA II 2', parseFixture('e').report.sources);
    expect(html).toContain('Fixation positions of KARA II 2');
    for (const text of ['Fixations', 'X (m)', 'Y (m)', 'Z (m)', 'Fr', 'Fl', 'Rr', 'Rl', '-2.84', '-2.16', '4.6', '3.9']) expect(html).toContain(text);
    expect(html.indexOf('Position X, Y, Z')).toBeLessThan(html.indexOf('Fixations'));
    expect(card('KS28 4', parseFixture('e').report.sources)).not.toContain('Fixations');
    expect(card('KARA II L Main')).not.toContain('Fixations');
  });

  it('draws fixations that share a name, and cuts a very long name', () => {
    const sources = structuredClone(parseFixture('e').report.sources);
    const fill = sources.find((s) => s.name === 'KARA II 2')!;
    fill.fixations = [
      { name: 'Fr', at: { x: 1, y: 2, z: 3 } },
      { name: 'Fr', at: { x: 4, y: 5, z: 6 } },
      { name: 'F'.repeat(60), at: { x: 7, y: 8, z: 9 } },
    ];
    const html = card('KARA II 2', sources);
    expect(html.match(/<th scope="row" title=/g)).toHaveLength(3);
    expect(html).toContain(`>${'F'.repeat(11)}…</th>`);
  });

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

  it('says MIRRORED and the name of the other array, and nothing else', () => {
    const covers = card('KARA II L Main', a, { coversMirror: 'KARA II R Main' });
    expect(covers).toContain('MIRRORED');
    expect(covers).toContain('<strong>KARA II R Main</strong>');
    expect(covers).not.toContain('exact left-right');
    expect(covers).not.toContain('not shown separately');
    const mirror = card('KARA II R Main', a, { mirrorOf: 'KARA II L Main' });
    expect(mirror).toContain('<strong>KARA II L Main</strong>');
    expect(mirror).not.toContain('exact left-right');
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

  it('names only pickups in its line when the report states no fixations, and shows no fixation table', () => {
    const html = renderToStaticMarkup(<RiggingSummary rows={riggingRows(b)} fixations={riggingFixations(b)} />);
    expect(html).toContain(riggingNote(true, false));
    expect(html).not.toContain('rigging-fixations');
  });

  it('lists the fixations of report E under the pickups, with the line that covers both', () => {
    const e = parseFixture('e').report.sources;
    const html = renderToStaticMarkup(<RiggingSummary rows={riggingRows(e)} fixations={riggingFixations(e)} />);
    expect(html).toContain('Every pickup and fixation is listed, including those of mirrored arrays, because their positions differ.');
    expect(html).toContain('rigging-fixations');
    expect(html).toContain('>Fixation<');
    expect(html).toContain('<td>Fr</td><td class="n">-2.84</td><td class="n">4.6</td><td class="n">1</td>');
    expect(html.match(/<td>Fr<\/td>/g)).toHaveLength(riggingFixations(e).filter((f) => f.name === 'Fr').length);
    expect(html.indexOf('Pickup positions')).toBeLessThan(html.indexOf('Fixation positions'));
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
