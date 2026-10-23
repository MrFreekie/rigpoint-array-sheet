import { useMemo } from 'react';
import { canvasMeasurePt, estimateWidth } from '../print/array-image';
import { PlotSvg } from '../print/PlotSvg';
import { plotContent } from '../print/plot-input';
import { layoutPlotPages, SCREEN_PALETTE } from '../print/plot-layout';
import type { Doc } from './document';
import type { SheetModel } from './sheet-model';

export const PLOT_DEVELOPMENT_NOTE = 'The rigging plot is under development and may include errors. Check it against the Soundvision report.';

/** The rigging plot as it will print, for the arrays chosen for printing. */
export function RiggingPlotPreview({ doc, model }: { doc: Doc; model: SheetModel }) {
  const pages = useMemo(() => {
    const content = plotContent(doc, model);
    return content ? layoutPlotPages({ ...content, footer: () => '' }, typeof document === 'undefined' ? estimateWidth : canvasMeasurePt()) : [];
  }, [doc, model]);
  return (
    <section className="panel" aria-labelledby="plot-heading" data-testid="plot-preview">
      <h2 id="plot-heading">Rigging plot</h2>
      <p className="muted">{PLOT_DEVELOPMENT_NOTE}</p>
      {pages.length === 0 ? (
        <p className="muted">No array chosen for printing has a position, a size and an azimuth in the report, so there is nothing to draw.</p>
      ) : (
        pages.map((p, i) => <PlotSvg key={i} page={p} palette={SCREEN_PALETTE} testId="plot-svg" label={i === 0 ? 'Rigging plot' : 'Rigging plot, table continued'} />)
      )}
    </section>
  );
}
