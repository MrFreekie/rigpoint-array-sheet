// Settings: the choices that apply to the whole job rather than to one card. The cart sizes, the side labels, the value written
// for each plot symbol, and whether the exact mirror images are shown. Each keeps its saved behaviour and is switched off in a read-only
// file. The Origin (P0) note, the ground offset every array uses and the venue sit under the rigging plot preview.

import { useId, useState } from 'react';
import { CART_SIZE_MAX, defaultCartSizes, sizeFor, type CartSize } from '../engine/carts';
import { cleanSymbolValue, DEFAULT_SYMBOL_VALUES, SHAPE_NAME, SHAPES, SYMBOL_VALUE_MAX, symbolValue, type Shape } from '../engine/markers';
import { Dialog } from './Dialog';
import type { Doc, Job } from './document';
import type { SheetModel } from './sheet-model';
import { SymbolIcon } from './SymbolIcon';

interface Props {
  doc: Doc;
  model: SheetModel;
  locked: boolean;
  onJob: (patch: Partial<Job>) => void;
  onCartSizes: (sizes: CartSize[]) => void;
  onSymbolValue: (shape: Shape, text: string) => void;
  onSymbolValuesReset: () => void;
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

/**
 * The value written for one plot symbol, with the shape drawn beside it. A blank field goes back to the usual value when the
 * person leaves it; while they type, a blank is not kept.
 */
function SymbolRow({ shape, value, disabled, onValue }: { shape: Shape; value: string; disabled: boolean; onValue: (text: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }
  return (
    <div className="settings-size">
      <label htmlFor={id}>
        <SymbolIcon shape={shape} /> <span>Symbol, {SHAPE_NAME[shape]}</span>
      </label>
      <input
        id={id}
        type="text"
        value={text}
        disabled={disabled}
        maxLength={SYMBOL_VALUE_MAX}
        autoComplete="off"
        onChange={(e) => {
          const next = cleanSymbolValue(e.target.value);
          setText(next);
          if (next.trim() !== '') onValue(next);
        }}
        onBlur={() => {
          if (text.trim() === '') {
            onValue('');
            setText(DEFAULT_SYMBOL_VALUES[shape]);
          }
        }}
      />
    </div>
  );
}

export function SettingsDialog({ doc, model, locked, onJob, onCartSizes, onSymbolValue, onSymbolValuesReset, showMirrors, onShowMirrors, onClose }: Props) {
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
          <div className="field">
            <label className="check-field">
              <input type="checkbox" checked={doc.job.sideLabels} disabled={locked} onChange={(e) => onJob({ sideLabels: e.target.checked })} />
              <span>Show side labels on the rigging plot</span>
            </label>
            <span className="field-hint">Names House left, House right, Stage and Audience. Turn off for a show in the round.</span>
          </div>
          <div className="field" role="group" aria-labelledby="settings-symbols">
            <h4 id="settings-symbols" className="settings-subhead">
              Symbols
            </h4>
            <span className="field-hint">
              The value written for each pickup symbol in the plot table, the key and the symbol lists. Change one to suit the show, for example 1.5 t. A blank field goes back to the usual value.
            </span>
            <div className="settings-sizes">
              {SHAPES.map((shape) => (
                <SymbolRow key={shape} shape={shape} value={symbolValue(doc.symbolValues, shape)} disabled={locked} onValue={(text) => onSymbolValue(shape, text)} />
              ))}
            </div>
            <p>
              <button type="button" className="button" disabled={locked} onClick={onSymbolValuesReset}>
                Reset the symbols to the usual values
              </button>
            </p>
          </div>
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
