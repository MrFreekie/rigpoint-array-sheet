import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { compareReports, matchByName, type Change } from '../engine/compare';
import { flySheetColumn, riggingRows } from '../engine/sheet';
import { findMirrors } from '../engine/symmetry';
import type { ParseResult } from '../engine/types';
import { openFileText, serialiseDoc } from '../files/array-file-io';
import { browserStore, readAutosave, writeAutosave, type Restorable } from '../files/autosave';
import { editKey, isDirty, isLocked, statusLocks } from '../files/doc';
import { downloadText } from '../files/download';
import { suggestedFileName } from '../files/file-name';
import { MAX_FILE_BYTES } from '../files/limits';
import { nextRevision } from '../files/revision';
import { ArrayCard } from './ArrayCard';
import { CompareDialog } from './CompareDialog';
import { effectiveOffset, newDoc, showTitle, STATUS_LABELS, type Doc, type Job, type Status } from './document';
import { JobForm } from './JobForm';
import { reportFromFile } from './load-report';
import { ProblemsPanel } from './ProblemsPanel';
import { RiggingSummary } from './RiggingSummary';
import { ThemeButton } from './ThemeButton';

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
const isJson = (file: File) => file.type === 'application/json' || /\.json$/i.test(file.name);

interface PendingCompare {
  fresh: ParseResult;
  sourceName: string;
  changes: Change[];
}

export function App() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [restore, setRestore] = useState<Restorable | null>(null);
  const [compare, setCompare] = useState<PendingCompare | null>(null);
  const openInput = useRef<HTMLInputElement>(null);
  const updateInput = useRef<HTMLInputElement>(null);

  const dirty = doc !== null && isDirty(doc);
  const locked = doc !== null && isLocked(doc);

  // Offer back a copy kept from an earlier visit that ended with unsaved changes.
  useEffect(() => {
    void readAutosave(browserStore).then((r) => {
      if (r) setRestore(r);
    });
  }, []);

  // Keep a copy in this browser while there are unsaved changes (a safety net, not a save).
  useEffect(() => {
    if (!doc || restore || !isDirty(doc)) return;
    const timer = setTimeout(() => void writeAutosave(browserStore, doc, __APP_VERSION__), 800);
    return () => clearTimeout(timer);
  }, [doc, restore]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function confirmDiscard(what: string): boolean {
    return !dirty || window.confirm(`The report you have open has unsaved changes. ${what}`);
  }

  async function openFile(file: File | undefined) {
    if (!file) return;
    if (!isPdf(file) && !isJson(file)) {
      setError('That is not a PDF or a RigPoint Array file. Choose a Soundvision report, or a file you saved from this app.');
      return;
    }
    if (!confirmDiscard('Open the other file anyway?')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (isJson(file)) {
        if (file.size > MAX_FILE_BYTES) throw new Error(`That file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB, which is too big for a RigPoint Array file.`);
        setDoc(openFileText(await file.text(), file.name).doc);
      } else {
        setDoc(newDoc(await reportFromFile(file), file.name));
      }
      setCompare(null);
      void browserStore.clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  }

  function onSave() {
    if (!doc || locked) return;
    const name = suggestedFileName(showTitle(doc), doc.revision);
    downloadText(name, serialiseDoc(doc, __APP_VERSION__));
    const saved: Doc = { ...doc, fileName: name, locked: statusLocks(doc.status) };
    saved.savedKey = editKey(saved);
    setDoc(saved);
    void browserStore.clear();
    setError(null);
    setNotice(
      saved.locked
        ? `Saved as ${name}. It is ${STATUS_LABELS[doc.status].toLowerCase()}, so it is now read-only.`
        : `Saved as ${name}. Your browser puts it in its downloads folder unless it asks where.`,
    );
  }

  function onStatus(status: Status) {
    if (!doc) return;
    if (statusLocks(status) && !window.confirm('Approved and superseded files are read-only once saved. To change one later you will need to create a new revision. Continue?')) return;
    setDoc({ ...doc, status });
  }

  function createRevision() {
    if (!doc) return;
    const revision = nextRevision(doc.revision);
    setDoc({ ...doc, status: 'draft', revision, fileName: null, savedKey: null, locked: false });
    setNotice(`Revision ${revision} started as a draft. It is not saved yet. Save it to keep it under its new name.`);
  }

  async function onUpdateChosen(file: File | undefined) {
    if (!file || !doc) return;
    if (!isPdf(file)) {
      setError('That is not a PDF. Choose the newer report exported from Soundvision.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const fresh = await reportFromFile(file);
      if (!fresh.ok) {
        const first = fresh.problems.find((p) => p.level === 'error');
        setError(`The new PDF cannot be relied on, so nothing was changed. ${first?.message ?? ''}`.trim());
        return;
      }
      const changes = compareReports(doc.result.report, fresh.report);
      if (changes.length === 0) setNotice(`${file.name} matches this file. There is nothing to update.`);
      else setCompare({ fresh, sourceName: file.name, changes });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  }

  function applyUpdate() {
    if (!doc || !compare) return;
    const map = matchByName(doc.result.report, compare.fresh.report);
    const offsets: Record<number, string> = {};
    for (const [i, text] of Object.entries(doc.offsets)) {
      const j = map.get(Number(i));
      if (j !== undefined) offsets[j] = text;
    }
    setDoc({ ...doc, result: compare.fresh, sourceName: compare.sourceName, offsets });
    setNotice(`Updated from ${compare.sourceName}. The file has unsaved changes.`);
    setCompare(null);
  }

  function startAgain() {
    if (!confirmDiscard('Start again anyway?')) return;
    setDoc(null);
    setError(null);
    setNotice(null);
    void browserStore.clear();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void openFile(e.dataTransfer.files[0]);
  }

  const patchJob = (patch: Partial<Job>) => setDoc((d) => (d && !d.locked ? { ...d, job: { ...d.job, ...patch } } : d));
  const setOffset = (index: number, text: string) =>
    setDoc((d) => (d && !d.locked ? { ...d, offsets: { ...d.offsets, [index]: text } } : d));
  const setRevision = (revision: string) => setDoc((d) => (d && !d.locked ? { ...d, revision } : d));

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
          <p className="show-title">
            {doc ? showTitle(doc) : 'No report open'}
            {doc ? (
              <span className="status-chip">
                {STATUS_LABELS[doc.status]}
                {doc.revision ? ` · Rev ${doc.revision}` : ''}
              </span>
            ) : null}
          </p>
          <p className="file-state" role="status">
            {!doc ? (
              <span>Nothing is stored or sent anywhere</span>
            ) : dirty ? (
              <span className="unsaved">● Unsaved changes</span>
            ) : locked ? (
              <span>Read-only · {doc.fileName}</span>
            ) : (
              <span>Saved · {doc.fileName}</span>
            )}
          </p>
        </div>
        <nav className="header-actions" aria-label="File">
          <button type="button" className="button" disabled={!doc || busy} onClick={startAgain}>
            New
          </button>
          <button type="button" className="button" disabled={busy} onClick={() => openInput.current?.click()}>
            Open
          </button>
          <button type="button" className="button primary" disabled={!doc || locked || busy} onClick={onSave}>
            Save
          </button>
          <button
            type="button"
            className="button"
            disabled={!doc || locked || busy}
            onClick={() => updateInput.current?.click()}
            title="Compare a newer Soundvision PDF with this file"
          >
            Update from PDF
          </button>
          {locked ? (
            <button type="button" className="button" disabled={busy} onClick={createRevision}>
              Create new revision
            </button>
          ) : null}
          <ThemeButton />
          <input
            ref={openInput}
            type="file"
            accept="application/pdf,.pdf,application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="open-file"
            onChange={(e) => {
              void openFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={updateInput}
            type="file"
            accept="application/pdf,.pdf"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="update-file"
            onChange={(e) => {
              void onUpdateChosen(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </nav>
        <p className="versions">App {__APP_VERSION__}</p>
      </header>

      <main className="main">
        {restore ? (
          <section className="banner banner-check" aria-labelledby="restore-heading" role="status">
            <h2 id="restore-heading">Restore unsaved changes to {showTitle(restore.doc)}?</h2>
            <p>
              This browser kept a copy from {new Date(restore.savedAt).toLocaleString('en-GB')}. It is a safety net, not a save. Save to a
              file to keep your work.
            </p>
            <p className="banner-actions">
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setDoc(restore.doc);
                  setRestore(null);
                }}
              >
                Restore
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  void browserStore.clear();
                  setRestore(null);
                }}
              >
                Discard
              </button>
            </p>
          </section>
        ) : null}
        {busy ? (
          <p className="banner" role="status">
            Reading the file…
          </p>
        ) : null}
        {error ? (
          <p className="banner banner-error" role="alert">
            <span className="tag tag-error">ERROR</span> {error}
          </p>
        ) : null}
        {notice ? (
          <p className="banner" role="status">
            {notice}
          </p>
        ) : null}
        {doc && locked ? (
          <p className="banner banner-check" role="status">
            <span className="tag tag-check">READ-ONLY</span> This file is {STATUS_LABELS[doc.status].toLowerCase()}, so it cannot be changed.
            Create a new revision to make changes.
          </p>
        ) : null}

        {!doc ? (
          <section className="empty" aria-labelledby="empty-heading">
            <h1 id="empty-heading">Open a Soundvision report</h1>
            <p>
              Choose the PDF report you exported from Soundvision, or drop it anywhere on this page. The app shows the array and rigging
              information it states, exactly as printed. It does not calculate loads or check that a rig is safe.
            </p>
            <p>You can also open a file you saved from this app. Files are read on this device only. Nothing is uploaded.</p>
            <p>
              <button type="button" className="button primary large" disabled={busy} onClick={() => openInput.current?.click()}>
                Open
              </button>
            </p>
          </section>
        ) : (
          <Report doc={doc} locked={locked} onJob={patchJob} onStatus={onStatus} onRevision={setRevision} onOffset={setOffset} />
        )}
      </main>

      {compare ? (
        <CompareDialog changes={compare.changes} sourceName={compare.sourceName} onUpdate={applyUpdate} onKeep={() => setCompare(null)} />
      ) : null}
    </div>
  );
}

interface ReportProps {
  doc: Doc;
  locked: boolean;
  onJob: (p: Partial<Job>) => void;
  onStatus: (s: Status) => void;
  onRevision: (r: string) => void;
  onOffset: (i: number, t: string) => void;
}

function Report({ doc, locked, onJob, onStatus, onRevision, onOffset }: ReportProps) {
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
          <JobForm doc={doc} locked={locked} onJob={onJob} onStatus={onStatus} onRevision={onRevision} />
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
                    locked={locked}
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
