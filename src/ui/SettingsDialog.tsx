// Settings: the choices that apply to the whole job rather than to one card. The cart sizes, the plot options and the venue, the
// ground offset every array uses, and whether the exact mirror images are shown. Each keeps its saved behaviour and is switched
// off in a read-only file.

import { useId, useState } from 'react';
import { CART_SIZE_MAX, defaultCartSizes, sizeFor, type CartSize } from '../engine/carts';
import type { Underlay } from '../engine/underlay';
import { ORIGIN_MAX } from '../schema/array-file';
import { Dialog } from './Dialog';
import { effectiveOffset, type Doc, type Job } from './document';
import type { SheetModel } from './sheet-model';
import { VenuePanel } from './VenuePanel';

interface Props {
  doc: Doc;
  model: SheetModel;
  locked: boolean;
  onJob: (patch: Partial<Job>) => void;
  onCartSizes: (sizes: CartSize[]) => void;
  onUnderlay: (underlay: Underlay | null) => void;
  onLayer: (name: string, hidden: boolean) => void;
  showMirrors: boolean;
  onShowMirrors: (show: boolean) => void;
  onClose: () => void;
}

/** The types of enclosure in the arrays that are not deleted, in the order the report lists them, each once (ignoring case). */
export function reportTypes(model: SheetModel): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  model.sources.forEach((s, i) => {
    if (!model.live.has(i)) return;
    for (const c of s.cabinets) {
      const type = c.type.trim();
      const key = type.toLowerCase();
      if (type !== '' && !seen.has(key)) {
        seen.add(key);
        out.push(type);
      }
    }
  });
  return out;
}

/** One type's boxes per cart. Blank means the type is not cut into carts. A value that is not a whole number from 1 to 24 is not kept. */
function SizeField({ type, size, disabled, note, onSize }: { type: string; size: number | undefined; disabled: boolean; note?: string; onSize: (size: number | undefined) => void }) {
  const id = useId();
  const [text, setText] = useState(size === undefined ? '' : String(size));
  // When the size changes from outside (Reset to the usual sizes), show it. Adjusting state while rendering, not in an effect.
  const [seen, setSeen] = useState(size);
  if (size !== seen) {
    setSeen(size);
    setText(size === undefined ? '' : String(size));
  }
  const n = Number(text.trim());
  const bad = text.trim() !== '' && !(Number.isInteger(n) && n >= 1 && n <= CART_SIZE_MAX);
  return (
    <div className="settings-size">
      <label htmlFor={id}>
        {type}
        {note ? <span className="muted"> ({note})</span> : null}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        maxLength={2}
        placeholder="one block"
        aria-invalid={bad}
        aria-describedby={bad ? `${id}-error` : undefined}
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value.replace(/[^0-9]/g, '');
          setText(next);
          if (next === '') onSize(undefined);
          else {
            const k = Number(next);
            if (Number.isInteger(k) && k >= 1 && k <= CART_SIZE_MAX) onSize(k);
          }
        }}
      />
      {bad ? (
        <span id={`${id}-error`} className="field-error">
          Enter a whole number from 1 to {CART_SIZE_MAX}, or leave it blank.
        </span>
      ) : null}
    </div>
  );
}

export function SettingsDialog({ doc, model, locked, onJob, onCartSizes, onUnderlay, onLayer, showMirrors, onShowMirrors, onClose }: Props) {
  const badDefault = effectiveOffset({ ...doc, offsets: {} }, 0).value === null;
  const types = reportTypes(model);
  const inReport = new Set(types.map((t) => t.toLowerCase()));
  const elsewhere = doc.cartSizes.filter((c) => !inReport.has(c.type.trim().toLowerCase()));
  const setSize = (type: string, size: number | undefined) => {
    const key = type.trim().toLowerCase();
    const same = (c: CartSize) => c.type.trim().toLowerCase() === key;
    if (size === undefined) onCartSizes(doc.cartSizes.filter((c) => !same(c)));
    else onCartSizes(doc.cartSizes.some(same) ? doc.cartSizes.map((c) => (same(c) ? { ...c, size } : c)) : [...doc.cartSizes, { type, size }]);
  };
  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="settings">
        <section aria-labelledby="settings-cards">
          <h3 id="settings-cards">Cards</h3>
          <p className="field-hint">
            Carts: how many enclosures of each type make a cart. Arrays are cut into carts of this size, from the top for a flown array and from the bottom for a stack, and a
            new cart always starts where the type changes. Leave a type blank to keep it as one block. The cards print every other cart shaded.
          </p>
          <div className="settings-sizes" role="group" aria-label="Boxes per cart, for each type of enclosure">
            {types.map((t) => (
              <SizeField key={t.toLowerCase()} type={t} size={sizeFor(doc.cartSizes, t)} disabled={locked} onSize={(size) => setSize(t, size)} />
            ))}
            {elsewhere.map((c) => (
              <SizeField key={c.type.toLowerCase()} type={c.type} size={c.size} disabled={locked} note="not in this report" onSize={(size) => setSize(c.type, size)} />
            ))}
          </div>
          <p>
            <button type="button" className="button" disabled={locked} onClick={() => onCartSizes(defaultCartSizes())}>
              Reset to the usual sizes
            </button>
          </p>
        </section>

        <section aria-labelledby="settings-plot">
          <h3 id="settings-plot">Rigging plot</h3>
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
          <div className="field">
            <label className="check-field">
              <input type="checkbox" checked={doc.job.sideLabels} disabled={locked} onChange={(e) => onJob({ sideLabels: e.target.checked })} />
              <span>Show side labels on the rigging plot</span>
            </label>
            <span className="field-hint">Names House left, House right, Stage and Audience. Turn off for a show in the round.</span>
          </div>
          <VenuePanel underlay={doc.underlay} locked={locked} onUnderlay={onUnderlay} onLayer={onLayer} />
        </section>

        <section aria-labelledby="settings-defaults">
          <h3 id="settings-defaults">Defaults</h3>
          <label className="field">
            <span>Ground offset for every array (m)</span>
            <input
              type="text"
              inputMode="decimal"
              value={doc.job.defaultOffset}
              disabled={locked}
              onChange={(e) => onJob({ defaultOffset: e.target.value })}
              aria-invalid={badDefault}
              aria-describedby="default-offset-hint"
              placeholder="0"
              autoComplete="off"
            />
            <span id="default-offset-hint" className={badDefault ? 'field-error' : 'field-hint'}>
              {badDefault ? 'Enter a number of metres, such as 0.3.' : 'Taken off the report heights. Each array can have its own.'}
            </span>
          </label>
        </section>

        <section aria-labelledby="settings-display">
          <h3 id="settings-display">Display</h3>
          {model.mirrorPairs > 0 ? (
            <label className="check-field">
              <input type="checkbox" checked={showMirrors} onChange={(e) => onShowMirrors(e.target.checked)} />
              <span>
                Show the {model.mirrorPairs} mirrored {model.mirrorPairs === 1 ? 'array' : 'arrays'} too (exact mirror images are hidden)
              </span>
            </label>
          ) : (
            <p className="muted">This report has no exact mirror images, so every array has its own card.</p>
          )}
        </section>
      </div>
      <div className="dialog-actions">
        <button type="button" className="button primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
