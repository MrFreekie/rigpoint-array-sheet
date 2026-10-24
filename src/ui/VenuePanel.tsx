import { useRef, useState } from 'react';
import { parseVenue, underlayEdgeCount, VENUE_MAX_BYTES, type Underlay } from '../engine/underlay';

interface Props {
  underlay: Underlay | null;
  /** A read-only file cannot take a venue or change its layers. */
  locked: boolean;
  onUnderlay: (underlay: Underlay | null) => void;
  onLayer: (name: string, hidden: boolean) => void;
}

const lines = (n: number) => `${n.toLocaleString('en-GB')} ${n === 1 ? 'line' : 'lines'}`;

/** Import, replace or remove the venue drawn grey under the rigging plot, and choose which of its layers show. */
export function VenuePanel({ underlay, locked, onUnderlay, onLayer }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; problem: boolean } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      if (file.size > VENUE_MAX_BYTES) {
        setMessage({ text: `This file is larger than ${VENUE_MAX_BYTES / 1024 / 1024} MB, which is too much for a venue. Simplify the model in SketchUp and export it again.`, problem: true });
        return;
      }
      const result = parseVenue(await file.text());
      if (!result.ok) {
        setMessage({ text: result.message, problem: true });
        return;
      }
      onUnderlay(result.underlay);
      const skipped = result.badLines > 0 ? ` ${lines(result.badLines)} of the file could not be read and were left out.` : '';
      setMessage({ text: `Imported ${lines(result.edges)} in ${result.underlay.layers.length} ${result.underlay.layers.length === 1 ? 'layer' : 'layers'}.${skipped}`, problem: false });
    } catch {
      setMessage({ text: 'This file could not be read.', problem: true });
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="venue-panel" data-testid="venue-panel">
      <h3>Venue under the plot</h3>
      <p className="field-hint">
        An optional grey drawing of the venue from an SU4SV text file (the SketchUp to Soundvision converter), in metres. Only the plan is kept, darker where it is lower. It never changes the scale of the plot.
      </p>
      <p>
        <input
          ref={input}
          type="file"
          accept=".txt,text/plain"
          hidden
          data-testid="venue-file"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <button type="button" className="button" disabled={locked} onClick={() => input.current?.click()}>
          {underlay ? 'Replace venue (SU4SV text file)' : 'Import venue (SU4SV text file)'}
        </button>{' '}
        {underlay ? (
          <button type="button" className="button" disabled={locked} onClick={() => { onUnderlay(null); setMessage(null); }}>
            Remove venue
          </button>
        ) : null}
      </p>
      {message ? (
        <p role={message.problem ? 'alert' : 'status'} className={message.problem ? 'field-error' : 'field-hint'}>
          {message.text}
        </p>
      ) : null}
      {underlay ? (
        <fieldset className="venue-layers">
          <legend>Layers to show ({lines(underlayEdgeCount(underlay))})</legend>
          {underlay.layers.map((l) => (
            <label key={l.name} className="check-field">
              <input type="checkbox" checked={!l.hidden} disabled={locked} onChange={(e) => onLayer(l.name, !e.target.checked)} />
              <span>
                {l.name} <span className="muted">({lines(l.shades.reduce((n, s) => n + s.edges.length / 4, 0))})</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
