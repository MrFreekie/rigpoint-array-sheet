// Turns Zod issues into plain-English messages that say which field is wrong.

import type { z } from 'zod';

const FIELD_NAMES: Record<string, string> = {
  format: 'File format',
  app_version: 'App version',
  saved_at: 'Saved at',
  status: 'Status',
  revision: 'Revision',
  source_name: 'Source name',
  job: 'Show details',
  show: 'Show',
  engineer: 'System engineer',
  company: 'Company',
  z_axis_zero: 'Z-axis zero',
  default_offset: 'Ground offset for every array',
  offsets: 'Ground offsets',
  report: 'Report',
  document: 'Document',
  sources: 'Arrays',
  problems: 'Problems',
  fileName: 'File name',
  distanceUnit: 'Distance unit',
  weightUnit: 'Weight unit',
  bottomElevation: 'Bottom elevation',
  topSite: 'Top site',
  bottomSite: 'Bottom site',
  frontMotorLoad: 'Front motor load',
  rearMotorLoad: 'Rear motor load',
  cabinets: 'Enclosures',
  topZ: 'Top height',
  bottomZ: 'Bottom height',
  weights: 'Weights',
  total: 'Total weight',
  enclosures: 'Enclosure weight',
  panflex: 'Panflex',
  pickups: 'Pickups',
  warnings: 'Warnings',
};

/** Describe a Zod issue path, e.g. "Array 2, Enclosures, entry 3, Top height". */
export function describePath(path: readonly PropertyKey[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    if (key === undefined) continue;
    if (key === 'report' && next !== undefined) continue;
    if (key === 'sources' && typeof next === 'number') {
      parts.push(`Array ${next + 1}`);
      i++;
    } else if (typeof key === 'number') {
      parts.push(`entry ${key + 1}`);
    } else {
      parts.push(FIELD_NAMES[String(key)] ?? String(key));
    }
  }
  return parts.join(', ');
}

/** Zod's own wording for a missing or wrongly typed value is not for a person. */
function plainMessage(message: string): string {
  const m = /^Invalid input: expected (.+), received (.+)$/.exec(message);
  if (!m) return message;
  return m[2] === 'undefined' ? 'is missing' : `must be ${m[1]}`;
}

export function formatIssues(error: z.ZodError, limit = 5): string[] {
  const lines = error.issues.slice(0, limit).map((issue) => {
    const where = describePath(issue.path);
    const message = plainMessage(issue.message);
    return where ? `${where}: ${message}` : message;
  });
  const more = error.issues.length - limit;
  if (more > 0) lines.push(`…and ${more} more problem${more === 1 ? '' : 's'}.`);
  return lines;
}
