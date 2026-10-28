import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseVenue } from '../engine/underlay';
import { VenueDialog, venueButtonLabel } from './VenueDialog';

const TEXT = ['"; LengthUnit","m"', '"Label","Walls 01"', '-20,-6,0', '20,-6,0', '20,50,0', '";"', '"Label","Roof 01"', '-15,4,12', '15,4,12', '";"'].join('\n');
const venue = () => {
  const r = parseVenue(TEXT);
  if (!r.ok) throw new Error('the made-up venue should read');
  return r.underlay;
};
const noop = () => {};
const html = (underlay = venue(), locked = false) => renderToStaticMarkup(<VenueDialog underlay={underlay} locked={locked} onUnderlay={noop} onLayer={noop} onClose={noop} />);

describe('the venue button label', () => {
  it('is just Venue until one is imported', () => {
    expect(venueButtonLabel(null)).toBe('Venue');
  });

  it('says how many of the layers are on', () => {
    const u = venue();
    expect(venueButtonLabel(u)).toBe('Venue: 2 of 2 layers on');
    expect(venueButtonLabel({ ...u, layers: u.layers.map((l, i) => ({ ...l, hidden: i === 0 })) })).toBe('Venue: 1 of 2 layers on');
    expect(venueButtonLabel({ ...u, layers: u.layers.slice(0, 1) })).toBe('Venue: 1 of 1 layer on');
  });
});

describe('the Venue under the plot box', () => {
  it('is a titled dialog with the venue panel, its layers and a Close button', () => {
    const out = html();
    expect(out).toContain('>Venue under the plot</h2>');
    expect(out).toContain('data-testid="venue-panel"');
    expect(out).toContain('Replace venue (SU4SV text file)');
    expect(out).toContain('Layers to show');
    expect(out).toContain('>Close<');
  });

  it('offers the import when there is no venue yet', () => {
    const out = renderToStaticMarkup(<VenueDialog underlay={null} locked={false} onUnderlay={noop} onLayer={noop} onClose={noop} />);
    expect(out).toContain('Import venue (SU4SV text file)');
    expect(out).not.toContain('Layers to show');
  });

  it('opens to be looked at in a read-only file, with every change switched off', () => {
    const out = html(venue(), true);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Replace venue/);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Remove venue/);
    expect((out.match(/<input type="checkbox"[^>]*disabled=""/g) ?? []).length).toBe(2);
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>Close/);
  });
});
