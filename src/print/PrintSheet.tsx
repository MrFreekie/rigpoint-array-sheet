// The printed sheet: long pages (one or two tall arrays, folded once), then pages of four pocket cards
// (fold the A4 page in half twice for A6 panels), then a rigging summary page. It is laid out off-screen at all times, so the rigging page can be
// measured and scaled, and only becomes visible when printing. The cards are planned from their calculated height.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { APP_URL } from '../app-info';
import { riggingFixations, riggingNote, riggingRows } from '../engine/sheet';
import type { Doc } from '../files/doc';
import { num } from '../ui/format';
import type { SheetModel } from '../ui/sheet-model';
import { cardContent, FIXATION_COLUMNS, warningText, type CardContent } from './card-content';
import { pageFooterText } from './footer';
import { panelHeader, type PanelHeader } from './panel-header';
import { qrMatrix, qrPath, qrSize } from './qr';
import { SMALL_PRINT } from './small-print';
import { canvasMeasurePt } from './array-image';
import { CARD_W_MM, FULL_H_MM, MIN_FULL_SCALE, PAGE_W_MM, fitScale, planPages } from './layout';
import {
  RIGGING_FIXATION_COLUMNS,
  RIGGING_FIXATION_WIDTHS_MM,
  RIGGING_PICKUP_COLUMNS,
  RIGGING_PICKUP_WIDTHS_MM,
  clipRiggingCell,
  riggingSubtitle,
  layoutPocketCard,
  ptToPx,
} from './pdf-layout';

function CardView({ content }: { content: CardContent }) {
  return (
    <div className="pc">
      <h3 className="pc-title">{content.title}</h3>
      <p className="pc-sub">{content.subtitle}</p>
      {content.mirrorNote ? <p className="pc-mirror">{content.mirrorNote}</p> : null}
      {content.warnings.length > 0 ? (
        <ul className="pc-warnings">
          {content.warnings.map((w, i) => (
            <li key={i}>
              <strong>{w.severity}</strong> {warningText(w)}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="pc-facts">
        {content.facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {content.fixations.length > 0 ? (
        <table className="pc-fix">
          <thead>
            <tr>
              {FIXATION_COLUMNS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.fixations.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <table className="pc-table">
        <thead>
          <tr>
            {content.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={j === 0 ? 'pc-no' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Who this panel is for. On every pocket panel, so a folded card still says whose it is. */
function PanelHead({ header }: { header: PanelHeader }) {
  return (
    <div className="as-panel-head">
      <p className="as-panel-brand">
        <span>{header.brand}</span>
        <span>{header.status}</span>
      </p>
      <p className="as-panel-title">{header.title}</p>
      {header.details ? <p className="as-panel-details">{header.details}</p> : null}
    </div>
  );
}

interface Props {
  doc: Doc;
  model: SheetModel;
  /** Footer text; each page adds its own "Page n of N". */
  footer: string;
  /** Number of items to check against the PDF, printed under the title when above zero. */
  checks: number;
  /** Called when something is too tall for its page even at the smallest scale. */
  onOverflow?: (overflow: boolean) => void;
}

export function PrintSheet({ doc, model, footer, checks, onOverflow }: Props) {
  const ctx = useMemo(
    () => ({ show: doc.job.show, venue: doc.job.venue, status: doc.status, revision: doc.revision, zAxisZero: doc.job.zAxisZero }),
    [doc.job.show, doc.job.venue, doc.status, doc.revision, doc.job.zAxisZero],
  );
  const contents = useMemo(() => model.entries.filter((e) => e.print).map((e) => ({ index: e.index, content: cardContent(e, ctx) })), [model, ctx]);
  const rigging = useMemo(() => riggingRows(doc.result.report.sources, model.printedSources), [doc.result.report.sources, model.printedSources]);
  const fixations = useMemo(() => riggingFixations(doc.result.report.sources, model.printedSources), [doc.result.report.sources, model.printedSources]);
  const note = riggingNote(rigging.length > 0, fixations.length > 0);
  // Names too long for their column are cut with an ellipsis, by the same rule as the PDF.
  const rigMeasure = useMemo(() => canvasMeasurePt(), []);
  const cell = (text: string, column: number, widthsMm: number[], size = 8) => clipRiggingCell(text, widthsMm[column] ?? 0, false, rigMeasure, size);
  const qr = useMemo(() => {
    const matrix = qrMatrix(APP_URL);
    return { path: qrPath(matrix), size: qrSize(matrix) };
  }, []);

  // The cards are planned from the height layoutPocketCard calculates, the same call the PDF makes, so the print
  // view and Download PDF put every array on the same page at the same scale. Only the rigging page is measured.
  const riggingRef = useRef<HTMLDivElement>(null);
  const [riggingHeight, setRiggingHeight] = useState(0);

  useLayoutEffect(() => {
    const el = riggingRef.current;
    if (!el) return;
    const measure = () => {
      // While printing the measuring copy is hidden and its height would read as zero. Keep what was measured.
      if (el.offsetHeight === 0) return;
      setRiggingHeight(el.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rigging, fixations]);

  const sized = useMemo(() => {
    const measure = canvasMeasurePt();
    return contents.map((c) => ({ item: c, heightPx: ptToPx(layoutPocketCard(c.content, measure).height) }));
  }, [contents]);
  const plan = useMemo(() => planPages(sized), [sized]);
  const riggingFit = fitScale(riggingHeight, FULL_H_MM, MIN_FULL_SCALE);
  const overflow = plan.some((p) => p.kind === 'long' && p.cards.some((c) => c.overflow)) || riggingFit.overflow;
  useEffect(() => onOverflow?.(overflow), [overflow, onOverflow]);

  const total = plan.length + 1;
  const draft = doc.status === 'draft';
  const footerText = (n: number) => pageFooterText(footer, checks, n, total);
  const pageFooter = (n: number) => <p className="as-footer">{footerText(n)}</p>;
  const header = useMemo(() => panelHeader(doc), [doc]);
  const watermark = draft ? (
    <div className="as-watermark" aria-hidden="true">
      DRAFT
    </div>
  ) : null;
  // Folded into pocket cards, a page-wide word would be cut across the panels. Every panel carries its own.
  const panelWatermark = draft ? (
    <div className="as-watermark as-watermark-panel" aria-hidden="true">
      DRAFT
    </div>
  ) : null;

  // A pocket panel or a long column: header, card, footer, and its own DRAFT mark.
  const panel = (c: { item: { index: number; content: CardContent }; scale: number }, pageNo: number) => {
    const heightPx = sized.find((s) => s.item.index === c.item.index)?.heightPx ?? 0;
    return (
      <div key={c.item.index} className="as-cell" data-testid="print-card">
        {panelWatermark}
        <PanelHead header={header} />
        <div className="as-cell-body">
          <div className="as-fit" data-planned-height={heightPx.toFixed(2)} style={{ width: `${CARD_W_MM}mm`, transform: c.scale < 1 ? `scale(${c.scale})` : undefined }}>
            <CardView content={c.item.content} />
          </div>
        </div>
        <p className="as-panel-footer">{footerText(pageNo)}</p>
      </div>
    );
  };

  const riggingTable = (
    <div className="as-rigging">
      <div className="as-rigging-head">
        <div>
          <h2>Rigging summary</h2>
          <p className="as-rigging-sub">
            {riggingSubtitle(doc.job)}
          </p>
        </div>
        <div className="as-qr" data-testid="print-qr">
          <svg viewBox={`0 0 ${qr.size} ${qr.size}`} width="30mm" height="30mm" role="img" aria-label={`QR code for ${APP_URL}`}>
            <rect width={qr.size} height={qr.size} fill="#fff" />
            <path d={qr.path} fill="#000" />
          </svg>
          <p>
            RigPoint Array
            <br />
            {APP_URL}
          </p>
        </div>
      </div>
      {rigging.length === 0 ? (
        <p className="as-rigging-note">No flown array in this report has a pickup position.</p>
      ) : (
        <>
          <table className="as-table" data-testid="print-pickups">
            <colgroup>
              {RIGGING_PICKUP_WIDTHS_MM.map((w, i) => (
                <col key={i} style={{ width: `${(w / 192) * 100}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {RIGGING_PICKUP_COLUMNS.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rigging.map((r, i) => (
                <tr key={i}>
                  <td>{cell(r.source, 0, RIGGING_PICKUP_WIDTHS_MM)}</td>
                  <td>{r.location}</td>
                  <td className="n">{r.pickupPosition}</td>
                  <td className="n">{r.x}</td>
                  <td className="n">{r.y}</td>
                  <td className="n">{r.z}</td>
                  <td className="n">{num(r.load)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {fixations.length > 0 ? (
        <table className="as-table as-table-second" data-testid="print-fixations">
          <colgroup>
            {RIGGING_FIXATION_WIDTHS_MM.map((w, i) => (
              <col key={i} style={{ width: `${(w / 192) * 100}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {RIGGING_FIXATION_COLUMNS.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fixations.map((f, i) => (
              <tr key={i}>
                <td>{cell(f.source, 0, RIGGING_FIXATION_WIDTHS_MM, 7)}</td>
                <td>{cell(f.name, 1, RIGGING_FIXATION_WIDTHS_MM, 7)}</td>
                <td className="n">{f.x}</td>
                <td className="n">{f.y}</td>
                <td className="n">{f.z}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {note ? <p className="as-rigging-note">{note}</p> : null}
      <div className="as-small-print" data-testid="print-small-print">
        {SMALL_PRINT.map((p, i) => (
          <p key={i}>
            {p.label ? <strong>{p.label} </strong> : null}
            {p.text}
          </p>
        ))}
      </div>
    </div>
  );

  return (
    <div className="print-root" aria-hidden="true" data-testid="print-sheet">
      <div className="as-measure" style={{ width: `${PAGE_W_MM - 6}mm` }}>
        <div ref={riggingRef}>{riggingTable}</div>
      </div>

      {plan.map((p, n) => (
        <section key={n} className={`as-page${p.kind === 'long' && p.cards.some((c) => c.overflow) ? ' as-page-overflow' : ''}`} data-testid="print-page">
          {p.kind === 'grid' ? (
            <div className="as-grid">
              {p.cards.map((c) => panel(c, n + 1))}
            </div>
          ) : (
            <div className="as-long">
              {p.cards.map((c) => panel(c, n + 1))}
            </div>
          )}
        </section>
      ))}

      {(
        <section className={`as-page${riggingFit.overflow ? ' as-page-overflow' : ''}`} data-testid="print-page">
          {watermark}
          <div className="as-full as-rigging-page">
            <div className="as-fit" style={{ width: `${PAGE_W_MM - 6}mm`, transform: riggingFit.scale < 1 ? `scale(${riggingFit.scale})` : undefined }}>
              {riggingTable}
            </div>
          </div>
          {pageFooter(total)}
        </section>
      )}
    </div>
  );
}
