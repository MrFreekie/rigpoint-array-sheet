import { useMemo, useRef, useState, type DragEvent } from 'react';
import { flySheetColumn, riggingRows } from '../engine/sheet';
import { findMirrors } from '../engine/symmetry';
import type { ParseResult } from '../engine/types';
import { ArrayCard } from './ArrayCard';
import { effectiveOffset, hasEdits, newDoc, showTitle, type Doc, type Job } from './document';
import { JobForm } from './JobForm';
import { reportFromFile } from './load-report';
import { ProblemsPanel } from './ProblemsPanel';
import { RiggingSummary } from './RiggingSummary';
import { ThemeButton } from './ThemeButton';

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function App() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const edited = doc !== null && hasEdits(doc);

  function confirmDiscard(): boolean {
    return !edited || window.confirm('Start again? The show details and ground offsets you typed will be lost.');
  }

  async function open(load: () => Promise<ParseResult>, sourceName: string) {
    if (!confirmDiscard()) return;
    setBusy(true);
    setError(null);
    try {
      setDoc(newDoc(await load(), sourceName));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!isPdf(file)) {
      setError('That is not a PDF. Choose the report you exported from Soundvision.');
      return;
    }
    void open(() => reportFromFile(file), file.name);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files[0]);
  }

  const patchJob = (patch: Partial<Job>) => setDoc((d) => (d ? { ...d, job: { ...d.job, ...patch } } : d));
  const setOffset = (index: number, text: string) =>
    setDoc((d) => (d ? { ...d, offsets: { ...d.offsets, [index]: text } } : d));

  return (
    <div
      className={`app${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header className="app-header">
        <div className="brand">
          <span className="brand-name">RigPoint</span> <span className="brand-app">Array</span>
        </div>
        <div className="show-heading">
          <p className="show-title">{doc ? showTitle(doc) : 'No report open'}</p>
          <p className="file-state" role="status">
            {doc ? (
              edited ? (
                <span className="unsaved">● Unsaved changes</span>
              ) : (
                <span>Opened from {doc.sourceName}</span>
              )
            ) : (
              <span>Nothing is stored or sent anywhere</span>
            )}
          </p>
        </div>
        <nav className="header-actions" aria-label="Report">
          <button
            type="button"
            className="button"
            disabled={!doc || busy}
            onClick={() => {
              if (confirmDiscard()) {
                setDoc(null);
                setError(null);
              }
            }}
          >
            New
          </button>
          <button type="button" className="button primary" disabled={busy} onClick={() => fileInput.current?.click()}>
            Open PDF
          </button>
          <ThemeButton />
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="open-file"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </nav>
        <p className="versions">App {__APP_VERSION__}</p>
      </header>

      <main className="main">
        {busy ? (
          <p className="banner" role="status">
            Reading the report…
          </p>
        ) : null}
        {error ? (
          <p className="banner banner-error" role="alert">
            <span className="tag tag-error">ERROR</span> {error}
          </p>
        ) : null}

        {!doc ? (
          <section className="empty" aria-labelledby="empty-heading">
            <h1 id="empty-heading">Open a Soundvision report</h1>
            <p>
              Choose the PDF report you exported from Soundvision, or drop it anywhere on this page. The app shows the array and rigging
              information it states, exactly as printed. It does not calculate loads or check that a rig is safe.
            </p>
            <p>The PDF is read on this device only. Nothing is uploaded.</p>
            <p>
              <button type="button" className="button primary large" disabled={busy} onClick={() => fileInput.current?.click()}>
                Open PDF
              </button>
            </p>
          </section>
        ) : (
          <Report doc={doc} onJob={patchJob} onOffset={setOffset} />
        )}
      </main>
    </div>
  );
}

function Report({ doc, onJob, onOffset }: { doc: Doc; onJob: (p: Partial<Job>) => void; onOffset: (i: number, t: string) => void }) {
  const { report, problems, ok } = doc.result;
  const [showMirrors, setShowMirrors] = useState(false);
  const mirrors = useMemo(() => findMirrors(report.sources), [report.sources]);
  const mirrorToShown = useMemo(() => new Map([...mirrors].map(([shown, mirror]) => [mirror, shown])), [mirrors]);
  const visible = report.sources.map((_, i) => i).filter((i) => showMirrors || !mirrorToShown.has(i));
  return (
    <>
      <ProblemsPanel problems={problems} ok={ok} />
      {ok ? (
        <>
          <JobForm doc={doc} onJob={onJob} />
          <section aria-labelledby="fly-heading">
            <h2 id="fly-heading" className="section-heading">
              Fly sheet
              <span className="count">
                {visible.length} of {report.sources.length} arrays shown
              </span>
            </h2>
            {mirrors.size > 0 ? (
              <label className="check-field">
                <input type="checkbox" checked={showMirrors} onChange={(e) => setShowMirrors(e.target.checked)} />
                <span>
                  Show the {mirrors.size} mirrored {mirrors.size === 1 ? 'array' : 'arrays'} too (exact left-right copies are hidden)
                </span>
              </label>
            ) : null}
            <p className="muted source-line">
              {report.document.fileName ? `Project: ${report.document.fileName}. ` : ''}
              {report.document.version ? `Soundvision ${report.document.version}. ` : ''}
              {report.document.date ? `Report dated ${report.document.date}.` : ''}
            </p>
            <div className="card-grid">
              {visible.map((i) => {
                const s = report.sources[i];
                if (!s) return null;
                const mirror = mirrors.get(i);
                const shown = mirrorToShown.get(i);
                const off = effectiveOffset(doc, i, mirror ?? shown);
                const column = flySheetColumn(s, off.value ?? 0);
                if (off.value === null) {
                  column.topHeight = null;
                  column.bottomHeight = null;
                }
                return (
                  <ArrayCard
                    key={i}
                    column={column}
                    coversMirror={mirror !== undefined && !showMirrors ? report.sources[mirror]?.name : undefined}
                    mirrorOf={shown !== undefined ? report.sources[shown]?.name : undefined}
                    offsetText={doc.offsets[i] ?? ''}
                    offsetBad={off.badField === 'array'}
                    defaultBad={off.badField === 'default'}
                    usingDefault={(doc.offsets[i] ?? '').trim() === ''}
                    onOffset={(t) => onOffset(i, t)}
                  />
                );
              })}
            </div>
          </section>
          <RiggingSummary rows={riggingRows(report.sources)} />
        </>
      ) : null}
    </>
  );
}
