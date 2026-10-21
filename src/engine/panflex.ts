// The Panflex label a fly sheet shows next to each enclosure, e.g. "70", "110" or "90 On".
// This is the one value the engine derives rather than copies, so the rule is spelled out:
//
//   - The number is the two Panflex figures added together (35/35 is 70, 55/55 is 110, 35/55 is 90).
//   - When the two figures differ, the wider side is "On" if it points towards the stage centre
//     and "Off" if it points away from it, seen from the box (the audience position).
//   - In the Soundvision samples the first figure points towards negative X and the second towards
//     positive X. An array at positive X therefore has its first figure on the centre side, and an
//     array at negative X has it on the outer side.
//
// The rule matches the left-hand arrays in the owner's sample output. The right-hand arrays follow
// by mirroring and have not been checked against a reference.

export interface PanflexLabel {
  total: number;
  /** Null when both sides are equal, or when the array sits on the centre line (X = 0). */
  side: 'on' | 'off' | null;
  /** True when the two figures differ but no side could be worked out. */
  sideUnknown: boolean;
  text: string;
}

const PANFLEX = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/;

/** @param arrayX the array's X position as printed in the report, or null when it has none. */
export function panflexLabel(panflex: string | null, arrayX: number | null): PanflexLabel | null {
  if (panflex === null) return null;
  const m = PANFLEX.exec(panflex);
  if (!m) return null;
  const first = Number(m[1]);
  const second = Number(m[2]);
  const total = first + second;

  if (first === second) return { total, side: null, sideUnknown: false, text: String(total) };
  if (arrayX === null || arrayX === 0) return { total, side: null, sideUnknown: true, text: String(total) };

  const widerPointsTowardsNegativeX = first > second;
  const arrayIsAtPositiveX = arrayX > 0;
  const towardsCentre = widerPointsTowardsNegativeX === arrayIsAtPositiveX;
  const side = towardsCentre ? 'on' : 'off';
  return { total, side, sideUnknown: false, text: `${total} ${side === 'on' ? 'On' : 'Off'}` };
}
