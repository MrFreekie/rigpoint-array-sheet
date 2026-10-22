// What one array's card says, as plain data. The printed pocket card and the PNG export both draw from
// this, so they show the same thing as each other and as the screen.

import { STATUS_LABELS, type Status } from '../files/doc';
import { degrees, kg, metres, NOT_STATED, num } from '../ui/format';
import type { SheetEntry } from '../ui/sheet-model';

export interface CardContext {
  show: string;
  status: Status;
  revision: string;
  zAxisZero: string;
}

export interface CardContent {
  title: string;
  /** Group and configuration. */
  subtitle: string;
  /** Show, status and Z-axis zero, so a card on its own is still traceable. */
  context: string;
  /** "MIRRORED: " and the name of the other array, when this card stands for a mirror image or is one. */
  mirrorNote: string | null;
  facts: [label: string, value: string][];
  warnings: { severity: string; title: string; message: string }[];
  columns: string[];
  rows: string[][];
}

export function cardContent(entry: SheetEntry, ctx: CardContext): CardContent {
  const c = entry.column;
  const pickups =
    c.pickups.length === 0 ? NOT_STATED : c.pickups.map((p) => `${p.which === 'front' ? 'Front' : 'Rear'} ${p.position}`).join(', ');

  const facts: CardContent['facts'] = [['Total mass', kg(c.totalMass)]];
  if (c.motors !== null) {
    facts.push(['Front motor load', kg(c.frontMotorLoad)]);
    if (c.motors > 1 || c.rearMotorLoad !== null) facts.push(['Rear motor load', kg(c.rearMotorLoad)]);
  }
  facts.push(
    ['Ground offset', entry.offset.value === null ? NOT_STATED : metres(entry.offset.value)],
    ['Top height', metres(c.topHeight)],
    ['Bottom height', metres(c.bottomHeight)],
    ['Top site', degrees(c.topSite)],
    ['Bottom site', degrees(c.bottomSite)],
    ['Azimuth', degrees(c.azimuth)],
    ['Frame', c.bumper ?? NOT_STATED],
    ['Pickups', pickups],
    ['Position X, Y, Z', c.position ? `${c.position.x}, ${c.position.y}, ${c.position.z} m` : NOT_STATED],
  );

  const hasAngles = c.rows.some((r) => r.angle !== null);
  const hasPanflex = c.rows.some((r) => r.panflexPrinted !== null);
  const columns = ['#', 'Type', ...(hasPanflex ? ['Panflex'] : []), ...(hasAngles ? ['Angle'] : []), 'Site'];
  const rows = c.rows.map((r) => [
    String(r.number),
    r.type,
    ...(hasPanflex ? [r.panflex ? `${r.panflex.text}${r.panflex.sideUnknown ? '?' : ''}` : (r.panflexPrinted ?? NOT_STATED)] : []),
    ...(hasAngles ? [num(r.angle)] : []),
    num(r.site),
  ]);

  const status = `${STATUS_LABELS[ctx.status]}${ctx.revision ? ` Rev ${ctx.revision}` : ''}`;
  return {
    title: c.name,
    subtitle: [c.group, c.configuration ?? 'configuration not stated'].filter(Boolean).join(' · '),
    context: [ctx.show.trim(), status, ctx.zAxisZero.trim() ? `Z-axis zero: ${ctx.zAxisZero.trim()}` : ''].filter(Boolean).join(' · '),
    mirrorNote: entry.coversMirror ? `MIRRORED: ${entry.coversMirror}` : entry.mirrorOf ? `MIRRORED: ${entry.mirrorOf}` : null,
    facts,
    warnings: c.warnings.map((w) => ({ ...w })),
    columns,
    rows,
  };
}
