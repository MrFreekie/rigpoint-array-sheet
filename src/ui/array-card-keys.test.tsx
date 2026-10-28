// Fixation names can repeat in a report, so the rows of the fixation table must not be keyed by name.

import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { flySheetColumn } from '../engine/sheet';
import { parseFixture } from '../testing/fixtures';
import { ArrayCard } from './ArrayCard';

vi.mock('react', async (original) => ({ ...(await original<typeof import('react')>()), useId: () => 'id' }));

function rowKeys(node: ReactNode): (string | null)[] | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = rowKeys(n);
      if (found) return found;
    }
    return null;
  }
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === 'tbody') return (Array.isArray(el.props.children) ? el.props.children : [el.props.children]).map((c: ReactElement) => c.key);
  return rowKeys(el.props?.children);
}

describe('ArrayCard fixation rows', () => {
  it('have a different key each, even when two fixations share a name', () => {
    const source = structuredClone(parseFixture('e').report.sources.find((s) => s.name === 'KARA II 2')!);
    source.fixations = [
      { name: 'Fr', at: { x: 1, y: 2, z: 3 } },
      { name: 'Fr', at: { x: 4, y: 5, z: 6 } },
    ];
    const tree = ArrayCard({ column: flySheetColumn(source), offsetText: '', offsetBad: false, defaultBad: false, usingDefault: true, onOffset: () => {}, titleText: '', reportName: source.name, onTitle: () => {}, note: '', onNote: () => {}, printed: true, onPrinted: () => {}, onPlot: true, onOnPlot: () => {}, markers: { front: { shape: 'one', text: '' }, rear: { shape: 'one', text: '' } }, onMarker: () => {}, patch: [], onPatch: () => {}, carts: { breaks: [], manual: false, groups: [source.cabinets.length], forced: [] }, onCartBreak: () => {}, onCartReset: () => {} });
    const keys = rowKeys(tree);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });
});
