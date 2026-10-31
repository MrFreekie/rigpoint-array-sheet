// The tuning sheet as one PNG, drawn on a canvas the way the card images are. A separate picture: no card image holds it.

import type { Doc } from '../files/doc';
import { tuningRows } from '../ui/tuning-rows';
import { layoutImageBlob } from './array-image';
import { panelHeader } from './panel-header';
import { layoutTuningPages } from './tuning-layout';

export function tuningImageBlob(doc: Doc, footer: string): Promise<Blob> {
  return layoutImageBlob((measure) => {
    const [page] = layoutTuningPages(
      { header: panelHeader(doc), rows: tuningRows(doc), footer: () => footer },
      measure,
      { width: 1000, height: null, font: 13, margin: 24 },
    );
    const layout = page ?? { width: 1000, height: 200, ops: [] };
    if (doc.status === 'draft') {
      layout.ops.push({ op: 'text', x: layout.width / 2, y: layout.height / 2 - 60, text: 'DRAFT', size: 150, bold: true, align: 'center', color: 'rgba(0,0,0,0.07)', rotate: -35 });
    }
    return layout;
  });
}
