import { useMemo, useState } from 'react';
import { suggestedDxfName } from '../files/file-name';
import { downloadBlob } from '../files/download';
import { canvasMeasurePt, estimateWidth } from '../print/array-image';
import { PlotSvg } from '../print/PlotSvg';
import { DXF_MIME, DXF_UNITS_NOTE, plotDxf } from '../print/plot-dxf';
import { plotContent } from '../print/plot-input';
import { layoutPlotPages, SCREEN_PALETTE } from '../print/plot-layout';
import { showTitle, type Doc } from './document';
import type { SheetModel } from './sheet-model';

export const PLOT_DEVELOPMENT_NOTE = 'The rigging plot is under development and may include errors. Check it against the Soundvision report.';

const measure = () => (typeof document === 'undefined' ? estimateWidth : canvasMeasurePt());

/** The rigging plot as it will print, for the arrays chosen for printing. */
export function RiggingPlotPreview({ doc, model }: { doc: Doc; model: SheetModel }) {
  const [error, setError] = useState<string | null>(null);
  const pages = useMemo(() => {
    const content = plotContent(doc, model);
    return content ? layoutPlotPages({ ...content, footer: () => '' }, measure()) : [];
  }, [doc, model]);

  function onDownloadDxf() {
    setError(null);
    try {
      const content = plotContent(doc, model);
      const text = content ? plotDxf({ ...content, footer: () => '' }, measure()) : null;
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
      {pages.length === 0 ? (
        <p className="muted">No array chosen for printing has a position, a size and an azimuth in the report, so there is nothing to draw.</p>
      ) : (
        <>
          {pages.map((p, i) => <PlotSvg key={i} page={p} palette={SCREEN_PALETTE} testId="plot-svg" label={i === 0 ? 'Rigging plot' : 'Rigging plot, table continued'} />)}
          <p>
            <button type="button" className="button" onClick={onDownloadDxf}>
              Download DXF
            </button>{' '}
            <span className="muted">{DXF_UNITS_NOTE}</span>
          </p>
          {error ? <p role="alert">{error}</p> : null}
        </>
      )}
    </section>
  );
}
