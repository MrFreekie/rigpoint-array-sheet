// Zod schema for the report the engine returns. Anything that reads a stored report
// (later phases: saved files, autosave) validates it here first, as untrusted input.

import { z } from 'zod';
import type { ParseResult } from '../engine/types';

const num = () => z.number({ error: 'must be a number' }).finite({ error: 'must be a finite number' });
const text = () => z.string({ error: 'must be text' });

const Point3Schema = z.object({ x: num(), y: num(), z: num() });

export const CabinetSchema = z.object({
  number: z.number({ error: 'Enclosure number must be a number' }).int({ error: 'Enclosure number must be a whole number' }).positive({ error: 'Enclosure number must be 1 or more' }),
  column: z.number({ error: 'Enclosure column must be a number' }).int({ error: 'Enclosure column must be a whole number' }).positive({ error: 'Enclosure column must be 1 or more' }).optional(),
  type: text(),
  angle: num().nullable(),
  site: num().nullable(),
  topZ: num().nullable(),
  bottomZ: num().nullable(),
  panflex: text().nullable(),
});

export const WarningSchema = z.object({
  severity: text(),
  title: text(),
  message: text(),
});

export const ArraySourceSchema = z.object({
  number: z.number({ error: 'Source number must be a number' }).int({ error: 'Source number must be a whole number' }),
  name: text(),
  groups: z.array(text(), { error: 'Groups must be a list' }),
  configuration: text().nullable(),
  orientation: z.enum(['vertical', 'horizontal'], { error: 'Orientation must be "vertical" or "horizontal"' }).nullable(),
  mounting: z.enum(['flown', 'stacked'], { error: 'Mounting must be "flown" or "stacked"' }).nullable(),
  bumper: text().nullable(),
  motors: z.number({ error: 'Motors must be a number' }).int({ error: 'Motors must be a whole number' }).nonnegative({ error: 'Motors must not be negative' }).nullable(),
  pickups: z.array(
    z.object({
      which: z.enum(['front', 'rear'], { error: 'Pickup must be "front" or "rear"' }),
      position: num(),
      at: Point3Schema,
    }),
    { error: 'Pickups must be a list' },
  ),
  fixationCount: z.number({ error: 'Fixations must be a number' }).int({ error: 'Fixations must be a whole number' }).nonnegative({ error: 'Fixations must not be negative' }).optional(),
  fixations: z.array(z.object({ name: text(), at: Point3Schema }), { error: 'Fixations must be a list' }).optional(),
  position: Point3Schema.nullable(),
  site: num().nullable(),
  azimuth: num().nullable(),
  dimensions: Point3Schema.nullable(),
  bottomElevation: num().nullable(),
  topSite: num().nullable(),
  bottomSite: num().nullable(),
  weights: z.object({
    total: num().nullable(),
    enclosures: num().nullable(),
    frontMotorLoad: num().nullable(),
    rearMotorLoad: num().nullable(),
  }),
  cabinets: z.array(CabinetSchema, { error: 'Enclosures must be a list' }),
  warnings: z.array(WarningSchema, { error: 'Warnings must be a list' }),
});

export const ReportSchema = z.object({
  document: z.object({
    version: text().nullable(),
    author: text().nullable(),
    date: text().nullable(),
    fileName: text().nullable(),
    distanceUnit: text().nullable(),
    weightUnit: text().nullable(),
  }),
  sources: z.array(ArraySourceSchema, { error: 'Sources must be a list' }),
});

export const ProblemSchema = z.object({
  level: z.enum(['error', 'check'], { error: 'Problem level must be "error" or "check"' }),
  source: text().nullable(),
  message: text(),
});

export const ParseResultSchema = z.object({
  report: ReportSchema,
  problems: z.array(ProblemSchema),
  ok: z.boolean({ error: 'ok must be true or false' }),
});

// Compile-time check that the schema and the engine's types describe the same thing.
export const _schemaMatchesTypes: z.ZodType<ParseResult> = ParseResultSchema;
