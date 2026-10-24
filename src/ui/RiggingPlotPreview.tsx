import { useMemo, useState } from 'react';
import { suggestedDxfName } from '../files/file-name';
import { downloadBlob } from '../files/download';
import { canvasMeasurePt, estimateWidth } from '../print/array-image';
import { PlotSvg } from '../print/PlotSvg';
import { DXF_MIME, DXF_UNITS_NOTE, plotDxf } from '../print/plot-dxf';
import { plotContent } from '../print/plot-input';
import { layoutPlotPages, SCREEN_PALETTE } from '../print/plot-layout';
import type { Underlay } from '../engine/underlay';
import { showTitle, type Doc } from './document';
import { VenuePanel } from './VenuePanel';
import type { SheetModel } from './sheet-model';

export const PLOT_DEVELOPMENT_NOTE = 'The rigging plot is under development and may include errors. Check it against the Soundvision report.';

const measure = () => (typeof document === 'undefined' ? estimateWidth : canvasMeasurePt());

/** The rigging plot as it will print, for the arrays chosen for printing. */
interface Props {
  doc: Doc;
  model: SheetModel;
  onUnderlay: (underlay: Underlay | null) => void;
  onLayer: (name: string, hidden: boolean) => void;
}

export function RiggingPlotPreview({ doc, model, onUnderlay, onLayer }: Props) {
  const [error, setError] = useState<string | null>(null);
  // Whether the DXF carries the venue. A choice for this download, not saved.
  const [venueInDxf, setVenueInDxf] = useState(false);
  const pages = useMemo(() => {
    const content = plotContent(doc, model);
    return content ? layoutPlotPages({ ...content, footer: () => '' }, measure()) : [];
  }, [doc, model]);

  function onDownloadDxf() {
    setError(null);
    try {
      const content = plotContent(doc, model);
      const text = content ? plotDxf({ ...content, footer: () => '' }, measure(), { venue: venueInDxf }) : null;
      if (text === null) return;
      downloadBlob(suggestedDxfName(showTitle(doc), doc.revision), new Blob([text], { type: DXF_MIME }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The DXF could not be made.');
    }
  }

  return (
    <section className="panel" aria-labelledby="plot-heading" data-testid="plot-preview">
      <h2 id="plot-heading">Rigging plot</h2>
      <p className="muted">{PLOT_DEVELOPMENT_NOTE}</p>
      <VenuePanel underlay={doc.underlay} locked={doc.locked} onUnderlay={onUnderlay} onLayer={onLayer} />
      {pages.length === 0 ? (
        <p className="muted">No array chosen for printing has a position, a size and an azimuth in the report, so there is nothing to draw.</p>
      ) : (
        <>
          {pages.map((p, i) => (
            // White space around the page on screen only. The plot stays on white in both themes, as it prints.
            <div key={i} className="plot-frame">
              <PlotSvg page={p} palette={SCREEN_PALETTE} testId="plot-svg" label={i === 0 ? 'Rigging plot' : 'Rigging plot, table continued'} />
            </div>
          ))}
          <p>
            <button type="button" className="button" onClick={onDownloadDxf}>
              Download DXF
            </button>{' '}
            <span className="muted">{DXF_UNITS_NOTE}</span>
          </p>
          {doc.underlay ? (
            <label className="check-field">
              <input type="checkbox" checked={venueInDxf} onChange={(e) => setVenueInDxf(e.target.checked)} />
              <span>Include venue in the DXF (the layers that are shown, on layers named VENUE_ and the SketchUp layer name)</span>
            </label>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </>
      )}
    </section>
  );
}
