// The venue under the rigging plot: import, replace or remove it and choose which of its layers show. A pop-out opened from the
// plot controls under the plot preview, on the same Dialog as Settings. In a read-only file it opens to be looked at and changes nothing.

import type { Underlay } from '../engine/underlay';
import { Dialog } from './Dialog';
import { VenuePanel } from './VenuePanel';

interface Props {
  underlay: Underlay | null;
  locked: boolean;
  onUnderlay: (underlay: Underlay | null) => void;
  onLayer: (name: string, hidden: boolean) => void;
  onClose: () => void;
}

/** The label of the button that opens the venue box: just Venue until one is imported, then how many of its layers show. */
export function venueButtonLabel(underlay: Underlay | null): string {
  if (!underlay) return 'Venue';
  const on = underlay.layers.filter((l) => !l.hidden).length;
  return `Venue: ${on} of ${underlay.layers.length} ${underlay.layers.length === 1 ? 'layer' : 'layers'} on`;
}

export function VenueDialog({ underlay, locked, onUnderlay, onLayer, onClose }: Props) {
  return (
    <Dialog title="Venue under the plot" onClose={onClose}>
      <VenuePanel underlay={underlay} locked={locked} onUnderlay={onUnderlay} onLayer={onLayer} />
      <div className="dialog-actions">
        <button type="button" className="button primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
