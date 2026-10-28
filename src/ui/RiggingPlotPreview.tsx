import { useId, useMemo, useState } from 'react';
import { suggestedDxfName } from '../files/file-name';
import { downloadBlob } from '../files/download';
import { canvasMeasurePt, estimateWidth } from '../print/array-image';
import { PlotSvg } from '../print/PlotSvg';
import { DXF_MIME, DXF_UNITS_NOTE, plotDxf } from '../print/plot-dxf';
import { plotContent } from '../print/plot-input';
import { layoutPlotPages, SCREEN_PALETTE } from '../print/plot-layout';
import { ORIGIN_MAX } from '../schema/array-file';
import { effectiveOffset, showTitle, type Doc, type Job } from './document';
import type { SheetModel } from './sheet-model';

export const PLOT_DEVELOPMENT_NOTE = 'The rigging plot is under development and may include errors. Check it against the Soundvision report.';

const measure = () => (typeof document === 'undefined' ? estimateWidth : canvasMeasurePt());

/** The rigging plot as it will print, for the arrays on the plot, with the controls that belong to it under it. */
interface Props {
  doc: Doc;
  model: SheetModel;
  locked: boolean;
  onJob: (patch: Partial<Job>) => void;
  onPlotPrinted: (printed: boolean) => void;
}

export function RiggingPlotPreview({ doc, model, locked, onJob, onPlotPrinted }: Props) {
  const hintId = useId();
  const badDefault = effectiveOffset({ ...doc, offsets: {} }, 0).value === null;
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
      <p className="muted">The side labels and the venue under the plot are in Settings.</p>
      {pages.length === 0 ? (
        <p className="muted">
          {model.hasPlot
            ? 'No array on the plot has a position, a size and an azimuth in the report, so there is nothing to draw.'
            : 'No array is on the plot. Tick Include on rigging plot on an array card to put it here.'}
        </p>
      ) : (
        <>
          {pages.map((p, i) => (
            // White space around the page on screen only. The plot stays on white in both themes, as it prints.
            <div key={i} className="plot-frame">
              <PlotSvg page={p} palette={SCREEN_PALETTE} testId="plot-svg" label={i === 0 ? 'Rigging plot' : 'Rigging plot, table continued'} />
            </div>
          ))}
        </>
      )}
      <div className="plot-controls" data-testid="plot-controls">
        <label className="field">
          <span>Origin (P0)</span>
          <input
            type="text"
            value={doc.job.origin}
            disabled={locked}
            maxLength={ORIGIN_MAX}
            onChange={(e) => onJob({ origin: e.target.value })}
            placeholder="e.g. DSE, Iron Line, Arena Centre"
            autoComplete="off"
          />
          <span className="field-hint">Where the Soundvision origin is. Printed on the rigging plot.</span>
        </label>
        <label className="field">
          <span>Ground offset for every array (m)</span>
          <input
            type="text"
            inputMode="decimal"
            value={doc.job.defaultOffset}
            disabled={locked}
            onChange={(e) => onJob({ defaultOffset: e.target.value })}
            aria-invalid={badDefault}
            aria-describedby={hintId}
            placeholder="0"
            autoComplete="off"
          />
          <span id={hintId} className={badDefault ? 'field-error' : 'field-hint'}>
            {badDefault ? 'Enter a number of metres, such as 0.3.' : 'Taken off the report heights. Each array can have its own.'}
          </span>
        </label>
        <label className="check-field">
          <input type="checkbox" checked={model.printsPlot} disabled={!model.hasPlot} onChange={(e) => onPlotPrinted(e.target.checked)} />
          <span>Print rigging plot (the plot is the page before the rigging summary)</span>
        </label>
        {pages.length > 0 ? (
          <div className="plot-download">
            <button type="button" className="button" onClick={onDownloadDxf}>
              Download DXF
            </button>{' '}
            <span className="muted">{DXF_UNITS_NOTE}</span>
            {doc.underlay ? (
              <label className="check-field">
                <input type="checkbox" checked={venueInDxf} onChange={(e) => setVenueInDxf(e.target.checked)} />
                <span>Include venue in the DXF (the layers that are shown, on layers named VENUE_ and the SketchUp layer name)</span>
              </label>
            ) : null}
          </div>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
