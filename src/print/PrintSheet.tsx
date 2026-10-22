// The printed sheet: pages of four pocket cards (fold the A4 page in half twice for A6 panels),
// then a rigging summary page. It is laid out off-screen at all times so every card can be measured
// and scaled to its panel, and only becomes visible when printing.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { APP_URL } from '../app-info';
import { riggingRows } from '../engine/sheet';
import type { Doc } from '../files/doc';
import { num } from '../ui/format';
import type { SheetModel } from '../ui/sheet-model';
import { cardContent, type CardContent } from './card-content';
import { qrMatrix, qrPath, qrSize } from './qr';
import { SMALL_PRINT } from './small-print';
import { CARD_W_MM, FULL_H_MM, MIN_FULL_SCALE, PAGE_W_MM, fitScale, planPages } from './layout';

function CardView({ content }: { content: CardContent }) {
  return (
    <div className="pc">
      <h3 className="pc-title">{content.title}</h3>
      <p className="pc-sub">{content.subtitle}</p>
      {content.context ? <p className="pc-context">{content.context}</p> : null}
      {content.mirrorNote ? <p className="pc-mirror">{content.mirrorNote}</p> : null}
      {content.warnings.length > 0 ? (
        <ul className="pc-warnings">
          {content.warnings.map((w, i) => (
            <li key={i}>
              <strong>{w.severity}</strong> {w.title}
              {w.message ? `. ${w.message}` : ''}
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
    () => ({ show: doc.job.show, status: doc.status, revision: doc.revision, zAxisZero: doc.job.zAxisZero }),
    [doc.job.show, doc.status, doc.revision, doc.job.zAxisZero],
  );
  const contents = useMemo(() => model.entries.filter((e) => e.print).map((e) => ({ index: e.index, content: cardContent(e, ctx) })), [model, ctx]);
  const rigging = useMemo(() => riggingRows(doc.result.report.sources, model.printedSources), [doc.result.report.sources, model.printedSources]);
  const qr = useMemo(() => {
    const matrix = qrMatrix(APP_URL);
    return { path: qrPath(matrix), size: qrSize(matrix) };
  }, []);

  // Measure every card at its real width, then plan the pages from the measurements.
  const measureRoot = useRef<HTMLDivElement>(null);
  const riggingRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const [riggingHeight, setRiggingHeight] = useState(0);

  useLayoutEffect(() => {
    const root = measureRoot.current;
    if (!root) return;
    const measure = () => {
      // While printing the measuring copy is hidden and every height would read as zero. Keep what was measured.
      if (root.offsetHeight === 0 && root.childElementCount > 0) return;
      const next: Record<number, number> = {};
      root.querySelectorAll<HTMLElement>('[data-index]').forEach((el) => {
        next[Number(el.dataset['index'])] = el.offsetHeight;
      });
      setHeights((old) => {
        const same = Object.keys(next).length === Object.keys(old).length && Object.entries(next).every(([k, v]) => old[Number(k)] === v);
        return same ? old : next;
      });
      setRiggingHeight(riggingRef.current?.offsetHeight ?? 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (riggingRef.current) observer.observe(riggingRef.current);
    return () => observer.disconnect();
  }, [contents, rigging]);

  const plan = useMemo(
    () => planPages(contents.map((c) => ({ item: c, heightPx: heights[c.index] ?? 0 }))),
    [contents, heights],
  );
  const riggingFit = fitScale(riggingHeight, FULL_H_MM, MIN_FULL_SCALE);
  const overflow = plan.some((p) => p.kind === 'full' && p.overflow) || riggingFit.overflow;
  useEffect(() => onOverflow?.(overflow), [overflow, onOverflow]);

  const total = plan.length + 1;
  const draft = doc.status === 'draft';
  const pageFooter = (n: number) => (
    <p className="as-footer">
      {footer}
      {checks > 0 ? ` · ${checks} to check against the PDF` : ''} · Page {n} of {total}
    </p>
  );
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

  const riggingTable = (
    <div className="as-rigging">
      <div className="as-rigging-head">
        <div>
          <h2>Rigging summary</h2>
          <p className="as-rigging-sub">
            {[doc.job.show.trim(), doc.job.zAxisZero.trim() ? `Z-axis zero: ${doc.job.zAxisZero.trim()}` : ''].filter(Boolean).join(' · ')}
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
          <table className="as-table">
            <thead>
              <tr>
                {['Array', 'Pickup', 'Position no.', 'X (m)', 'Y (m)', 'Z (m)', 'Load (kg)'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rigging.map((r, i) => (
                <tr key={i}>
                  <td>{r.source}</td>
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
          <p className="as-rigging-note">Every pickup is listed, including those of mirrored arrays, because their positions differ.</p>
        </>
      )}
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
      <div className="as-measure" ref={measureRoot} style={{ width: `${CARD_W_MM}mm` }}>
        {contents.map((c) => (
          <div key={c.index} data-index={c.index}>
            <CardView content={c.content} />
          </div>
        ))}
      </div>
      <div className="as-measure" style={{ width: `${PAGE_W_MM - 6}mm` }}>
        <div ref={riggingRef}>{riggingTable}</div>
      </div>

      {plan.map((p, n) => (
        <section key={n} className={`as-page${p.kind === 'full' && p.overflow ? ' as-page-overflow' : ''}`} data-testid="print-page">
          {p.kind === 'grid' ? null : watermark}
          {p.kind === 'grid' ? (
            <div className="as-grid">
              {p.cards.map((c) => (
                <div key={c.item.index} className="as-cell" data-testid="print-card">
                  {panelWatermark}
                  <div className="as-fit" style={{ width: `${CARD_W_MM}mm`, transform: c.scale < 1 ? `scale(${c.scale})` : undefined }}>
                    <CardView content={c.item.content} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="as-full" data-testid="print-card">
              <div className="as-fit" style={{ width: `${CARD_W_MM}mm`, transform: p.scale < 1 ? `scale(${p.scale})` : undefined }}>
                <CardView content={p.item.content} />
              </div>
            </div>
          )}
          {pageFooter(n + 1)}
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
