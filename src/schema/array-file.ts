// Zod schema for saved files (*.arraysheet.json, format "arraysheet/1").
// Every opened file is untrusted: it is validated here before anything reads it.

import { z } from 'zod';
import { STATUSES } from '../files/doc';
import {
  MAX_CABINETS_PER_SOURCE,
  MAX_PICKUPS_PER_SOURCE,
  MAX_PROBLEMS,
  MAX_SOURCES,
  MAX_TEXT_LENGTH,
  MAX_WARNINGS_PER_SOURCE,
} from '../files/limits';
import { REVISION_PATTERN } from '../files/revision';
import { ProblemSchema, ReportSchema } from './report';

export const FORMAT_NAME = 'arraysheet';
export const FORMAT_VERSION = 1;
export const FORMAT = `${FORMAT_NAME}/${FORMAT_VERSION}`;

const text = (what: string, max = 500) => z.string({ error: `${what} must be text` }).max(max, { error: `${what} is too long` });

export const ArrayFileSchema = z
  .object({
    format: z.literal(FORMAT, { error: `File format must be "${FORMAT}"` }),
    app_version: text('App version', 40),
    saved_at: z.iso.datetime({ error: 'Saved at must be a date and time' }),
    status: z.enum(STATUSES, { error: 'Status must be draft, issued, approved or superseded' }),
    revision: z
      .string({ error: 'Revision must be text' })
      .regex(REVISION_PATTERN, { error: 'Revision must be blank or one or two capital letters' }),
    source_name: text('Source name', 300),
    job: z.object({
      show: text('Show'),
      engineer: text('Engineer'),
      company: text('Company'),
      z_axis_zero: text('Z-axis zero'),
      default_offset: text('Ground offset', 20),
    }),
    offsets: z.array(text('Ground offset', 20), { error: 'Offsets must be a list' }),
    report: ReportSchema,
    problems: z.array(ProblemSchema, { error: 'Problems must be a list' }).max(MAX_PROBLEMS, { error: 'There are too many problems listed' }),
  })
  .superRefine((file, ctx) => {
    const { sources } = file.report;
    if (sources.length > MAX_SOURCES) {
      ctx.addIssue({ code: 'custom', path: ['report', 'sources'], message: `There are more than ${MAX_SOURCES} arrays` });
      return;
    }
    if (file.offsets.length !== sources.length) {
      ctx.addIssue({ code: 'custom', path: ['offsets'], message: 'There must be one ground offset for each array' });
    }
    sources.forEach((s, i) => {
      const at = ['report', 'sources', i] as const;
      if (s.cabinets.length > MAX_CABINETS_PER_SOURCE) {
        ctx.addIssue({ code: 'custom', path: [...at, 'cabinets'], message: `There are more than ${MAX_CABINETS_PER_SOURCE} enclosures` });
      }
      if (s.warnings.length > MAX_WARNINGS_PER_SOURCE) {
        ctx.addIssue({ code: 'custom', path: [...at, 'warnings'], message: `There are more than ${MAX_WARNINGS_PER_SOURCE} warnings` });
      }
      if (s.pickups.length > MAX_PICKUPS_PER_SOURCE) {
        ctx.addIssue({ code: 'custom', path: [...at, 'pickups'], message: `There are more than ${MAX_PICKUPS_PER_SOURCE} pickups` });
      }
      const long: [string, string][] = [
        ['name', s.name],
        ['bumper', s.bumper ?? ''],
        ['configuration', s.configuration ?? ''],
      ];
      for (const [key, value] of long) {
        if (value.length > MAX_TEXT_LENGTH) ctx.addIssue({ code: 'custom', path: [...at, key], message: 'is too long' });
      }
      s.warnings.forEach((w, wi) => {
        if (w.message.length > MAX_TEXT_LENGTH || w.title.length > MAX_TEXT_LENGTH) {
          ctx.addIssue({ code: 'custom', path: [...at, 'warnings', wi], message: 'is too long' });
        }
      });
    });
  });

export type ArrayFile = z.infer<typeof ArrayFileSchema>;
