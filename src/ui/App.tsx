import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { compareReports, type Change } from '../engine/compare';
import { trackExtras } from '../engine/extra-weight';
import { trackCarts } from '../engine/carts';
import { trackPatches, type PatchField, type PatchValue } from '../engine/patch';
import { symbolValue, trackMarkers, type Marker, type PickupSide } from '../engine/markers';
import { riggingFixations, riggingRows, riggingWeights } from '../engine/sheet';
import type { ParseResult, Problem } from '../engine/types';
import { openFileText, serialiseDoc } from '../files/array-file-io';
import { browserStore, readAutosave, writeAutosave, type Restorable } from '../files/autosave';
import { deletedList, editKey, isDirty, isLocked, keepsHandle, markSaved, sameDocument, statusLocks } from '../files/doc';
import { downloadBlob } from '../files/download';
import { suggestedFileName, suggestedImageName, suggestedPdfName } from '../files/file-name';
import { ensurePermission, fsAccessSupported, pickFileToOpen } from '../files/fs-access';
import { idbStore } from '../files/kv';
import { onLaunchFile } from '../files/launch';
import { MAX_FILE_BYTES } from '../files/limits';
import { addRecent, listRecent, removeRecent, sameHandle, type RecentFile } from '../files/recent';
import { nextRevision } from '../files/revision';
import { saveText } from '../files/save-flow';
import { takeSharedFile } from '../files/share-target';
import { cardImageBlob } from '../print/array-image';
import { cardContent } from '../print/card-content';
import { printFooter } from '../print/footer';
import { PrintSheet } from '../print/PrintSheet';
import { ArrayCard } from './ArrayCard';
import { CompareDialog } from './CompareDialog';
import type { CartSize } from '../engine/carts';
import type { Shape } from '../engine/markers';
import type { Underlay } from '../engine/underlay';
import { newDoc, showTitle, STATUS_LABELS, updatedDoc, visibleProblems, extraOf, markerOf, withCartBreak, withCartReset, withCartSizes, withDeleted, withExtra, withPatch, withLayerHidden, withMarker, withNote, plotShown, withOnPlot, withPlotPrinted, withPlotShow, withPrinted, withSymbolValue, withSymbolValuesReset, withTitle, withUnderlay, type Doc, type Job, type PlotShow, type Status } from './document';
import { JobForm } from './JobForm';
import { NotesPanel } from './NotesPanel';
import { reportFromFile } from './load-report';
import { ProblemsPanel } from './ProblemsPanel';
import { pointLabelOf } from '../print/plot-input';
import { RecentFilesDialog } from './RecentFilesDialog';
import { RiggingPlotPreview } from './RiggingPlotPreview';
import { RiggingSummary } from './RiggingSummary';
import { SettingsDialog } from './SettingsDialog';
import { extraKgFor, sheetModel, type SheetEntry, type SheetModel } from './sheet-model';
import { ThemeButton } from './ThemeButton';
import { UpdatePrompt } from './UpdatePrompt';

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
  // The browser would not keep the safety copy, so the person is told to save to a file.
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [compare, setCompare] = useState<PendingCompare | null>(null);
  const [showMirrors, setShowMirrors] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const [printOverflow, setPrintOverflow] = useState(false);
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  /** Positions in the report of the arrays deleted this session, latest last. Never saved: only Undo reads it. */
  const [undoStack, setUndoStack] = useState<number[]>([]);
  const undoButton = useRef<HTMLButtonElement>(null);
  const undoDepth = useRef(0);
  const fsAccess = useMemo(fsAccessSupported, []);
  const openInput = useRef<HTMLInputElement>(null);
  const docRef = useRef<Doc | null>(null);
  const openRef = useRef<(file: File, handle: FileSystemFileHandle | null) => void>(() => undefined);
  const updateInput = useRef<HTMLInputElement>(null);

  const dirty = doc !== null && isDirty(doc);
  const locked = doc !== null && isLocked(doc);
  const model = useMemo(() => (doc ? sheetModel(doc, showMirrors) : null), [doc, showMirrors]);
  const printCount = model ? model.entries.filter((e) => e.print).length : 0;
  const printable = doc !== null && doc.result.ok && model !== null && !model.badOffsets && printCount > 0;
  const problems = useMemo(() => (doc ? visibleProblems(doc) : []), [doc]);
  const checks = problems.filter((p) => p.level === 'check').length;

  // After a delete, put the focus on Undo, so the next key press can take it back.
  useEffect(() => {
    if (undoStack.length > undoDepth.current) undoButton.current?.focus();
    undoDepth.current = undoStack.length;
  }, [undoStack]);

  // Offer back a copy kept from an earlier visit that ended with unsaved changes.
  useEffect(() => {
    void readAutosave(browserStore).then((r) => {
      if (r) setRestore(r);
    });
  }, []);

  // Recent files, when the browser can keep file handles.
  useEffect(() => {
    if (fsAccess) void listRecent(idbStore).then(setRecent);
  }, [fsAccess]);

  // A file double-clicked in the installed app (Chrome and Edge), or shared from Android.
  useEffect(() => {
    onLaunchFile((h) => void h.getFile().then((f) => openRef.current(f, h)));
    void takeSharedFile().then((shared) => {
      if (!shared) return;
      if ('error' in shared) setError(shared.error);
      else openRef.current(shared.file, null);
    });
  }, []);

  // Keep a copy in this browser while there are unsaved changes (a safety net, not a save).
  useEffect(() => {
    if (!doc || restore || !isDirty(doc)) return;
    const timer = setTimeout(() => void writeAutosave(browserStore, doc, __APP_VERSION__).then((ok) => setAutosaveFailed(!ok)), 800);
    return () => clearTimeout(timer);
  }, [doc, restore]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Stamp the time on the sheet just before it prints, however printing was started (button or Ctrl+P).
  useEffect(() => {
    const stamp = () => flushSync(() => setPrintedAt(new Date()));
    window.addEventListener('beforeprint', stamp);
    return () => window.removeEventListener('beforeprint', stamp);
  }, []);

  async function saveImages(entries: readonly SheetEntry[]) {
    if (!doc || entries.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const ctx = { show: doc.job.show, venue: doc.job.venue, status: doc.status, revision: doc.revision, zAxisZero: doc.job.zAxisZero, showDate: doc.job.showDate };
      const footer = printFooter({
        appVersion: __APP_VERSION__,
        soundvisionVersion: doc.result.report.document.version,
        fileName: doc.fileName,
        defaultName: suggestedFileName(showTitle(doc), doc.revision),
        dirty,
        printedAt: new Date(),
        verb: 'Exported',
      });
      for (const entry of entries) {
        const blob = await cardImageBlob(cardContent(entry, ctx), { footer, draft: doc.status === 'draft' });
        downloadBlob(suggestedImageName(showTitle(doc), entry.column.name), blob);
        if (entries.length > 1) await new Promise((r) => setTimeout(r, 250));
      }
      setNotice(
        entries.length === 1
          ? `Saved ${entries[0]?.column.name} as an image.`
          : `Saved ${entries.length} images. Your browser may ask whether to allow several downloads.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The images could not be made.');
    } finally {
      setBusy(false);
    }
  }

  /** The PDF in one click: made on this device and downloaded, with no print window. */
  async function onDownloadPdf() {
    if (!doc || !model || !printable) return;
    setBusy(true);
    setError(null);
    try {
      const { renderPdf } = await import('../print/pdf-export');
      const bytes = await renderPdf({
        doc,
        model,
        checks,
        footer: printFooter({
          appVersion: __APP_VERSION__,
          soundvisionVersion: doc.result.report.document.version,
          fileName: doc.fileName,
          defaultName: suggestedFileName(showTitle(doc), doc.revision),
          dirty,
          printedAt: new Date(),
          verb: 'Exported',
        }),
      });
      const name = suggestedPdfName(showTitle(doc), doc.revision);
      downloadBlob(name, new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      setNotice(`Saved ${name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The PDF could not be made.');
    } finally {
      setBusy(false);
    }
  }

  function onPrint() {
    flushSync(() => setPrintedAt(new Date()));
    window.print();
  }

  function confirmDiscard(what: string): boolean {
    return !dirty || window.confirm(`The report you have open has unsaved changes. ${what}`);
  }

  async function openFile(file: File | undefined, fileHandle: FileSystemFileHandle | null = null) {
    if (!file) return;
    if (!isPdf(file) && !isJson(file)) {
      setError('That is not a PDF or a RigPoint Array Sheet file. Choose a Soundvision report, or a file you saved from this app.');
      return;
    }
    if (!confirmDiscard('Open the other file anyway?')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (isJson(file)) {
        if (file.size > MAX_FILE_BYTES) throw new Error(`That file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB, which is too big for a RigPoint Array Sheet file.`);
        setDoc(openFileText(await file.text(), file.name).doc);
        setHandle(fileHandle);
        if (fileHandle) void remember(fileHandle);
      } else {
        setDoc(newDoc(await reportFromFile(file), file.name));
        setHandle(null);
      }
      setCompare(null);
      setUndoStack([]);
      // The opened file replaces whatever the kept copy was for, and the offer must not block autosave.
      setRestore(null);
      void browserStore.clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  }

  function remember(h: FileSystemFileHandle) {
    return addRecent(idbStore, h, sameHandle).then(setRecent);
  }

  docRef.current = doc;
  openRef.current = (file, h) => void openFile(file, h);

  /** Open: the browser's own picker where it has one (so Save can write back), a file input elsewhere. */
  async function chooseFile() {
    if (!fsAccess) {
      openInput.current?.click();
      return;
    }
    try {
      const h = await pickFileToOpen();
      if (h) await openFile(await h.getFile(), h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be opened.');
    }
  }

  /** Save writes back to the file it came from; Save As (asNew) always asks where. Without the browser feature it downloads. */
  async function onSave(asNew: boolean) {
    if (!doc || locked) return;
    const snapshot = doc;
    const suggested = suggestedFileName(showTitle(snapshot), snapshot.revision);
    setError(null);
    try {
      const outcome = await saveText({ text: serialiseDoc(snapshot, __APP_VERSION__), suggestedName: suggested, handle, asNew });
      if (outcome.kind === 'cancelled') return;
      if (outcome.kind === 'denied') {
        setError(`The browser did not allow the app to write to ${outcome.name}. Nothing was saved. Try Save As.`);
        return;
      }
      const cur = docRef.current;
      if (!cur || !sameDocument(cur, snapshot)) {
        // Another file was opened while this one was being written: leave the new document alone.
        if (outcome.kind === 'handle') void remember(outcome.handle);
        setNotice(`Saved ${outcome.kind === 'handle' ? 'to' : 'as'} ${outcome.name}.`);
        return;
      }
      const key = editKey(snapshot);
      // Anything typed while a picker was open stays unsaved: only what was written counts as saved.
      // A file written as approved or superseded locks the document if its status still says so.
      const lockNow = statusLocks(snapshot.status) && statusLocks(cur.status);
      setDoc((c) => (c ? markSaved(c, snapshot, outcome.name, key) : c));
      void browserStore.clear();
      if (outcome.kind === 'handle') {
        void remember(outcome.handle);
        setHandle(keepsHandle(cur, snapshot) ? outcome.handle : null);
      } else {
        setHandle(null);
      }
      setNotice(
        lockNow
          ? `Saved ${outcome.kind === 'handle' ? 'to' : 'as'} ${outcome.name}. It is ${STATUS_LABELS[snapshot.status].toLowerCase()}, so it is now read-only.`
          : outcome.kind === 'handle'
            ? `Saved to ${outcome.name}.`
            : `Saved as ${outcome.name}. Your browser puts it in its downloads folder unless it asks where.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be saved.');
    }
  }

  async function openRecent(file: RecentFile) {
    try {
      if (!(await ensurePermission(file.handle, 'read'))) {
        setError('The browser did not allow the app to read that file.');
        return;
      }
      const f = await file.handle.getFile();
      setRecentOpen(false);
      await openFile(f, file.handle);
    } catch {
      setError(`${file.name} could not be found any more. It may have been moved or deleted.`);
      setRecent(await removeRecent(idbStore, file.handle, sameHandle));
    }
  }

  function onStatus(status: Status) {
    if (!doc) return;
    if (statusLocks(status) && !window.confirm('Approved and superseded files are read-only once saved. To change one later you will need to create a new revision. Continue?')) return;
    setDoc({ ...doc, status });
  }

  function createRevision() {
    if (!doc) return;
    const revision = nextRevision(doc.revision);
    setDoc({ ...doc, status: 'draft', revision, fileName: null, savedKey: null, locked: false, noPrint: doc.printOverride ?? doc.noPrint, printOverride: null, noPlot: doc.plotOverride ?? doc.noPlot, plotOverride: null, plotPrintOff: doc.plotPrintOverride ?? doc.plotPrintOff, plotPrintOverride: null, plotShow: plotShown(doc), plotShowOverride: null, markers: doc.markerOverride ?? doc.markers, markerOverride: null });
    // A new revision never writes over the file it came from: Save asks where.
    setHandle(null);
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
      const changes = compareReports(doc.result.report, fresh.report, new Set(deletedList(doc)), doc.titles, trackMarkers(doc.result.report, fresh.report, doc.markers).reset.map((r) => ({ array: r.array, side: r.side, value: symbolValue(doc.symbolValues, r.shape), fallback: symbolValue(doc.symbolValues, 'one') })), trackPatches(doc.result.report, fresh.report, doc.patches).reset, trackCarts(doc.result.report, fresh.report, doc.carts).reset, trackExtras(doc.result.report, fresh.report, doc.extras).reset);
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
    setDoc(updatedDoc(doc, compare.fresh, compare.sourceName));
    setUndoStack([]);
    setNotice(`Updated from ${compare.sourceName}. The file has unsaved changes.`);
    setCompare(null);
  }

  function startAgain() {
    if (!confirmDiscard('Start again anyway?')) return;
    setDoc(null);
    setUndoStack([]);
    setHandle(null);
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
  const setPrinted = (index: number, printed: boolean) => setDoc((d) => (d ? withPrinted(d, index, printed) : d));
  const setOnPlot = (index: number, on: boolean) => setDoc((d) => (d ? withOnPlot(d, index, on) : d));
  const setPlotPrinted = (printed: boolean) => setDoc((d) => (d ? withPlotPrinted(d, printed) : d));
  const setPlotShow = (patch: Partial<PlotShow>) => setDoc((d) => (d ? withPlotShow(d, patch) : d));
  const setTitle = (index: number, text: string) => setDoc((d) => (d ? withTitle(d, index, text) : d));
  const setNote = (index: number, text: string) => setDoc((d) => (d ? withNote(d, index, text) : d));
  const setUnderlay = (underlay: Underlay | null) => setDoc((d) => (d ? withUnderlay(d, underlay) : d));
  const setLayerHidden = (name: string, hidden: boolean) => setDoc((d) => (d ? withLayerHidden(d, name, hidden) : d));
  const setExtra = (index: number, side: PickupSide, text: string) => setDoc((d) => (d ? withExtra(d, index, side, text) : d));
  const setMarker = (index: number, side: PickupSide, marker: Marker) => setDoc((d) => (d ? withMarker(d, index, side, marker) : d));
  const setCartBreak = (index: number, row: number) => setDoc((d) => (d ? withCartBreak(d, index, row) : d));
  const resetCarts = (index: number) => setDoc((d) => (d ? withCartReset(d, index) : d));
  const setCartSizes = (sizes: CartSize[]) => setDoc((d) => (d ? withCartSizes(d, sizes) : d));
  const setSymbolValue = (shape: Shape, text: string) => setDoc((d) => (d ? withSymbolValue(d, shape, text) : d));
  const resetSymbolValues = () => setDoc((d) => (d ? withSymbolValuesReset(d) : d));
  const setPatch = (index: number, row: number, field: PatchField, value: PatchValue) => setDoc((d) => (d ? withPatch(d, index, row, field, value) : d));
  const deleteArray = (index: number) => {
    if (!doc || doc.locked) return;
    setDoc(withDeleted(doc, index, true));
    setUndoStack((s) => [...s, index]);
  };
  const undoDelete = () => {
    const index = undoStack[undoStack.length - 1];
    if (index === undefined) return;
    setDoc((d) => (d ? withDeleted(d, index, false) : d));
    setUndoStack((s) => s.slice(0, -1));
  };
  const restoreArray = (index: number) => {
    setDoc((d) => (d ? withDeleted(d, index, false) : d));
    setUndoStack((s) => s.filter((i) => i !== index));
  };
  const setRevision = (revision: string) => setDoc((d) => (d && !d.locked ? { ...d, revision } : d));

  return (
    <>
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
          <span className="brand-name">RigPoint</span> <span className="brand-app">Array Sheet</span>
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
              <span className="unsaved">● Unsaved changes{autosaveFailed ? '. This browser could not keep a safety copy, so save the file to keep your work.' : ''}</span>
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
          <button type="button" className="button" disabled={busy} onClick={() => void chooseFile()}>
            Open
          </button>
          {fsAccess && recent.length > 0 ? (
            <button type="button" className="button" disabled={busy} onClick={() => setRecentOpen(true)}>
              Recent
            </button>
          ) : null}
          <button
            type="button"
            className="button primary"
            disabled={!doc || locked || busy}
            onClick={() => void onSave(false)}
            title={handle ? `Save to ${handle.name}` : undefined}
          >
            Save
          </button>
          {fsAccess ? (
            <button type="button" className="button" disabled={!doc || locked || busy} onClick={() => void onSave(true)}>
              Save As
            </button>
          ) : null}
          <button
            type="button"
            className="button"
            disabled={!doc || locked || busy}
            onClick={() => updateInput.current?.click()}
            title="Compare a newer Soundvision PDF with this file"
          >
            Update from PDF
          </button>
          <button
            type="button"
            className="button"
            disabled={!printable || busy}
            onClick={onPrint}
            title={
              doc && !printable
                ? printCount === 0 && doc.result.ok
                  ? 'Choose at least one array to print'
                  : 'Fix the problems with the report or the ground offsets first'
                : 'Print, or save as PDF from the print window'
            }
          >
            Print / PDF
          </button>
          <button
            type="button"
            className="button"
            disabled={!printable || busy}
            onClick={() => void onDownloadPdf()}
            title={doc && !printable ? 'Fix the problems with the report or the ground offsets, and choose at least one array' : 'Download the PDF without opening the print window'}
          >
            Download PDF
          </button>
          {locked ? (
            <button type="button" className="button" disabled={busy} onClick={createRevision}>
              Create new revision
            </button>
          ) : null}
          <button type="button" className="button" disabled={!doc || !doc.result.ok || busy} onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
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
        <UpdatePrompt dirty={dirty} />
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
                disabled={busy}
                onClick={() => {
                  setDoc(restore.doc);
                  setUndoStack([]);
                  // The kept copy was never written to a file, so Save must ask where.
                  setHandle(null);
                  setCompare(null);
                  setRestore(null);
                }}
              >
                Restore
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  // Only hide the offer once the copy is really gone, so a quick reload cannot find it again.
                  void browserStore.clear().then(() => setRestore(null));
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
        {printOverflow ? (
          <p className="banner banner-check" role="status">
            <span className="tag tag-check">CHECK</span> An array is too tall to print in full, even in a long column. Split it into shorter arrays, or
            check the PDF before relying on it.
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
              <button type="button" className="button primary large" disabled={busy} onClick={() => void chooseFile()}>
                Open
              </button>
            </p>
          </section>
        ) : (
          <Report
            doc={doc}
            model={model}
            problems={problems}
            undoLabel={undoStack.length > 0 ? (doc.result.report.sources[undoStack[undoStack.length - 1] ?? -1]?.name ?? null) : null}
            undoButton={undoButton}
            onDelete={deleteArray}
            onUndo={undoDelete}
            onRestore={restoreArray}
            showMirrors={showMirrors}
            onShowMirrors={setShowMirrors}
            locked={locked}
            busy={busy}
            onJob={patchJob}
            onStatus={onStatus}
            onRevision={setRevision}
            onOffset={setOffset}
            onTitle={setTitle}
            onNote={setNote}
            onMarker={setMarker}
            onExtra={setExtra}
            onPatch={setPatch}
            onCartBreak={setCartBreak}
            onCartReset={resetCarts}
            onPrinted={setPrinted}
            onOnPlot={setOnPlot}
            onPlotPrinted={setPlotPrinted}
            onPlotShow={setPlotShow}
            onUnderlay={setUnderlay}
            onLayer={setLayerHidden}
            onImage={(entry) => void saveImages([entry])}
            onAllImages={() => model && void saveImages(model.entries.filter((e) => e.print))}
          />
        )}
      </main>

      {recentOpen ? (
        <RecentFilesDialog
          files={recent}
          onOpen={(f) => void openRecent(f)}
          onRemove={(f) => void removeRecent(idbStore, f.handle, sameHandle).then(setRecent)}
          onClose={() => setRecentOpen(false)}
        />
      ) : null}
      {settingsOpen && doc && model && doc.result.ok ? (
        <SettingsDialog
          doc={doc}
          model={model}
          locked={locked}
          onJob={patchJob}
          onCartSizes={setCartSizes}
          onSymbolValue={setSymbolValue}
          onSymbolValuesReset={resetSymbolValues}
          showMirrors={showMirrors}
          onShowMirrors={setShowMirrors}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {compare ? (
        <CompareDialog changes={compare.changes} sourceName={compare.sourceName} onUpdate={applyUpdate} onKeep={() => setCompare(null)} />
      ) : null}
    </div>
    {doc && printable && model ? (
      <PrintSheet
        doc={doc}
        model={model}
        checks={checks}
        footer={printFooter({
          appVersion: __APP_VERSION__,
          soundvisionVersion: doc.result.report.document.version,
          fileName: doc.fileName,
          defaultName: suggestedFileName(showTitle(doc), doc.revision),
          dirty,
          printedAt,
        })}
        onOverflow={setPrintOverflow}
      />
    ) : null}
    </>
  );
}

interface ReportProps {
  doc: Doc;
  model: SheetModel | null;
  /** The problems to show: the checks that concern only deleted arrays are left out. */
  problems: readonly Problem[];
  /** The name of the array a click on Undo would bring back, or null when there is nothing to undo. */
  undoLabel: string | null;
  undoButton: RefObject<HTMLButtonElement | null>;
  onDelete: (i: number) => void;
  onUndo: () => void;
  onRestore: (i: number) => void;
  showMirrors: boolean;
  onShowMirrors: (show: boolean) => void;
  locked: boolean;
  busy: boolean;
  onJob: (p: Partial<Job>) => void;
  onStatus: (s: Status) => void;
  onRevision: (r: string) => void;
  onOffset: (i: number, t: string) => void;
  onTitle: (i: number, t: string) => void;
  onNote: (i: number, t: string) => void;
  onMarker: (i: number, side: PickupSide, marker: Marker) => void;
  onExtra: (i: number, side: PickupSide, text: string) => void;
  onPatch: (i: number, row: number, field: PatchField, value: PatchValue) => void;
  onCartBreak: (i: number, row: number) => void;
  onCartReset: (i: number) => void;
  onPrinted: (i: number, printed: boolean) => void;
  onOnPlot: (i: number, on: boolean) => void;
  onPlotPrinted: (printed: boolean) => void;
  onPlotShow: (patch: Partial<PlotShow>) => void;
  onUnderlay: (underlay: Underlay | null) => void;
  onLayer: (name: string, hidden: boolean) => void;
  onImage: (entry: SheetEntry) => void;
  onAllImages: () => void;
}

function Report({ doc, model, problems, undoLabel, undoButton, onDelete, onUndo, onRestore, showMirrors, onShowMirrors, locked, busy, onJob, onStatus, onRevision, onOffset, onTitle, onNote, onMarker, onExtra, onPatch, onCartBreak, onCartReset, onPrinted, onOnPlot, onPlotPrinted, onPlotShow, onUnderlay, onLayer, onImage, onAllImages }: ReportProps) {
  const { report, ok } = doc.result;
  const printCount = model ? model.entries.filter((e) => e.print).length : 0;
  return (
    <>
      <ProblemsPanel problems={problems} ok={ok} />
      {ok && model ? (
        <>
          <JobForm doc={doc} locked={locked} onJob={onJob} onStatus={onStatus} onRevision={onRevision} />
          <section aria-labelledby="fly-heading">
            <h2 id="fly-heading" className="section-heading">
              Fly sheet
              <span className="count">
                {model.entries.length} of {model.live.size} arrays shown
              </span>
            </h2>
            <div className="sheet-tools">
              <button type="button" className="button" disabled={busy || model.badOffsets || printCount === 0} onClick={onAllImages}>
                Save selected as images
              </button>
              <button type="button" className="button" ref={undoButton} disabled={undoLabel === null || locked} onClick={onUndo}>
                {undoLabel === null ? 'Undo delete' : `Undo delete of ${undoLabel}`}
              </button>
            </div>
            {model.mirrorPairs > 0 ? (
              <p className="muted source-line" data-testid="mirrors-line">
                {showMirrors
                  ? `The ${model.mirrorPairs} mirrored ${model.mirrorPairs === 1 ? 'array is' : 'arrays are'} shown too. `
                  : `${model.mirrorPairs} exact mirror ${model.mirrorPairs === 1 ? 'image is' : 'images are'} hidden, because ${model.mirrorPairs === 1 ? 'its partner stands' : 'their partners stand'} for ${model.mirrorPairs === 1 ? 'it' : 'them'}. `}
                <button type="button" className="button" aria-pressed={showMirrors} onClick={() => onShowMirrors(!showMirrors)}>
                  {showMirrors ? 'Hide them' : 'Show them'}
                </button>
              </p>
            ) : null}
            {model.deletedList.length > 0 ? (
              <div className="muted source-line" data-testid="deleted-list">
                <p>
                  {model.deletedList.length} deleted. The report still holds {model.deletedList.length === 1 ? 'it' : 'them'}, so
                  {model.deletedList.length === 1 ? ' it' : ' they'} can be restored. {locked ? 'This file is read-only, so nothing can be restored.' : ''}
                </p>
                <ul className="deleted-list">
                  {model.deletedList.map((d) => (
                    <li key={d.index}>
                      {d.name}{' '}
                      <button type="button" className="button" disabled={locked} onClick={() => onRestore(d.index)} aria-label={`Restore ${d.name}`}>
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="muted source-line" data-testid="print-count">
              {printCount === model.entries.length
                ? `All ${printCount} arrays shown are chosen for printing and as images.`
                : `${printCount} of ${model.entries.length} arrays shown are chosen for printing and as images.`}
            </p>
            <p className="muted source-line">
              {report.document.fileName ? `Project: ${report.document.fileName}. ` : ''}
              {report.document.version ? `Soundvision ${report.document.version}. ` : ''}
              {report.document.date ? `Report dated ${report.document.date}.` : ''}
            </p>
            <div className="card-grid">
              {model.entries.map((entry) => (
                <ArrayCard
                  key={entry.index}
                  column={entry.column}
                  locked={locked}
                  coversMirror={entry.coversMirror}
                  mirrorOf={entry.mirrorOf}
                  offsetText={doc.offsets[entry.index] ?? ''}
                  offsetBad={entry.offset.badField === 'array'}
                  defaultBad={entry.offset.badField === 'default'}
                  usingDefault={(doc.offsets[entry.index] ?? '').trim() === ''}
                  onOffset={(t) => onOffset(entry.index, t)}
                  titleText={doc.titles[entry.index] ?? ''}
                  reportName={entry.reportName}
                  onTitle={(t) => onTitle(entry.index, t)}
                  note={doc.notes[entry.index] ?? ''}
                  onNote={(t) => onNote(entry.index, t)}
                  markers={{ front: markerOf(doc, entry.index, 'front'), rear: markerOf(doc, entry.index, 'rear') }}
                  onMarker={(side, m) => onMarker(entry.index, side, m)}
                  extras={{ front: extraOf(doc, entry.index, 'front'), rear: extraOf(doc, entry.index, 'rear') }}
                  onExtra={(side, t) => onExtra(entry.index, side, t)}
                  symbolValues={doc.symbolValues}
                  patch={entry.patch}
                  onPatch={(row, field, value) => onPatch(entry.index, row, field, value)}
                  carts={entry.carts}
                  onCartBreak={(row) => onCartBreak(entry.index, row)}
                  onCartReset={() => onCartReset(entry.index)}
                  printed={entry.print}
                  onPrinted={(p) => onPrinted(entry.index, p)}
                  onPlot={entry.plot}
                  onOnPlot={(p) => onOnPlot(entry.index, p)}
                  onImage={entry.offset.value === null ? undefined : () => onImage(entry)}
                  onDelete={locked ? undefined : () => onDelete(entry.index)}
                />
              ))}
            </div>
          </section>
          <RiggingPlotPreview doc={doc} model={model} locked={locked} onJob={onJob} onPlotPrinted={onPlotPrinted} onPlotShow={onPlotShow} onUnderlay={onUnderlay} onLayer={onLayer} />
          <RiggingSummary rows={riggingRows(model.sources, model.live, extraKgFor(doc, model), pointLabelOf(model))} weights={riggingWeights(model.sources, model.live, extraKgFor(doc, model))} fixations={riggingFixations(model.sources, model.live)} />
          <NotesPanel doc={doc} locked={locked} onJob={onJob} />
        </>
      ) : null}
    </>
  );
}
