// What the fly sheet and rigging summary show for each array.
// Almost everything is copied from the report. The two heights are the exception: the owner's
// fly sheet subtracts a ground offset (the floor level the heights are measured from) from the
// report's heights. That subtraction, rounded to the 0.01 m the report prints, is the only sum here.

import { panflexLabel, type PanflexLabel } from './panflex';
import type { ArraySource, Pickup, SoundvisionWarning } from './types';

export interface SheetRow {
  number: number;
  type: string;
  angle: number | null;
  site: number | null;
  panflex: PanflexLabel | null;
  /** The Panflex value as the PDF prints it, for when no label could be made. */
  panflexPrinted: string | null;
}

export interface FlySheetColumn {
  name: string;
  /** The innermost Soundvision group, or null when the report has no groups. */
  group: string | null;
  configuration: string | null;
  mounting: 'flown' | 'stacked' | null;
  totalMass: number | null;
  frontMotorLoad: number | null;
  rearMotorLoad: number | null;
  groundOffset: number;
  /** Position Z minus the ground offset. */
  topHeight: number | null;
  /** Bottom elevation minus the ground offset. */
  bottomHeight: number | null;
  topSite: number | null;
  bottomSite: number | null;
  azimuth: number | null;
  bumper: string | null;
  motors: number | null;
  pickups: Pickup[];
  position: ArraySource['position'];
  rows: SheetRow[];
  warnings: SoundvisionWarning[];
}

const hundredths = (n: number) => Math.round(n * 100) / 100;

export function minus(value: number | null, offset: number): number | null {
  return value === null ? null : hundredths(value - offset);
}

export function flySheetColumn(source: ArraySource, groundOffset = 0): FlySheetColumn {
  const x = source.position?.x ?? null;
  return {
    name: source.name,
    group: source.groups[source.groups.length - 1] ?? null,
    configuration: source.configuration,
    mounting: source.mounting,
    totalMass: source.weights.total,
    frontMotorLoad: source.weights.frontMotorLoad,
    rearMotorLoad: source.weights.rearMotorLoad,
    groundOffset,
    topHeight: minus(source.position?.z ?? null, groundOffset),
    bottomHeight: minus(source.bottomElevation, groundOffset),
    topSite: source.topSite,
    bottomSite: source.bottomSite,
    azimuth: source.azimuth,
    bumper: source.bumper,
    motors: source.motors,
    pickups: source.pickups,
    position: source.position,
    rows: source.cabinets.map((c) => ({
      number: c.number,
      type: c.type,
      angle: c.angle,
      site: c.site,
      panflex: panflexLabel(c.panflex, x),
      panflexPrinted: c.panflex,
    })),
    warnings: source.warnings,
  };
}

export interface RiggingRow {
  source: string;
  location: 'Front' | 'Rear';
  /** The pickup position number as the report prints it. */
  pickupPosition: number;
  x: number;
  y: number;
  z: number;
  /** The motor load for this pickup, or null when the report does not state one. */
  load: number | null;
}

/**
 * One row per pickup of every flown array, in report order. Give `include` (positions in the report)
 * to list only some of the arrays.
 */
export function riggingRows(sources: readonly ArraySource[], include?: ReadonlySet<number>): RiggingRow[] {
  const rows: RiggingRow[] = [];
  for (const [index, s] of sources.entries()) {
    if (include && !include.has(index)) continue;
    for (const p of s.pickups) {
      rows.push({
        source: s.name,
        location: p.which === 'front' ? 'Front' : 'Rear',
        pickupPosition: p.position,
        x: p.at.x,
        y: p.at.y,
        z: p.at.z,
        load: p.which === 'front' ? s.weights.frontMotorLoad : s.weights.rearMotorLoad,
      });
    }
  }
  return rows;
}

/** A ground offset typed by the user: blank means 0, anything that is not a number is rejected. */
export function parseOffset(text: string): number | null {
  const t = text.trim().replace(/−/g, '-');
  if (t === '') return 0;
  return /^-?\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}
