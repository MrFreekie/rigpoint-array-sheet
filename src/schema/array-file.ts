// Zod schema for saved files (*.arraysheet.json, format "arraysheet/7").
// Every opened file is untrusted: it is validated here before anything reads it.

import { z } from 'zod';
import { STATUSES } from '../files/doc';
import {
  MAX_CABINETS_PER_SOURCE,
  MAX_FIXATIONS_PER_SOURCE,
  MAX_PICKUPS_PER_SOURCE,
  MAX_PROBLEMS,
  MAX_SOURCES,
  MAX_TEXT_LENGTH,
  MAX_WARNINGS_PER_SOURCE,
} from '../files/limits';
import { REVISION_PATTERN } from '../files/revision';
import { isShowDate } from '../files/show-date';
import { ProblemSchema, ReportSchema } from './report';

export const FORMAT_NAME = 'arraysheet';
export const FORMAT_VERSION = 7;
export const FORMAT = `${FORMAT_NAME}/${FORMAT_VERSION}`;

/** The longest Origin (P0) note the file accepts. */
export const ORIGIN_MAX = 100;
/** The longest card title and the longest note for one array. */
export const TITLE_MAX = 60;
export const NOTES_MAX = 300;
/** The longest note for the whole show. */
export const SHOW_NOTES_MAX = 500;

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
      venue: text('Venue'),
      engineer: text('Engineer'),
      company: text('Company'),
      z_axis_zero: text('Z-axis zero'),
      default_offset: text('Ground offset', 20),
      origin: text('Origin (P0)', ORIGIN_MAX),
      side_labels: z.boolean({ error: 'Side labels must be true or false' }),
      notes: text('Show notes', SHOW_NOTES_MAX),
      show_date: text('Show date', 10),
    }),
    offsets: z.array(text('Ground offset', 20), { error: 'Offsets must be a list' }),
    print: z.array(z.boolean({ error: 'Print must be true or false' }), { error: 'Print choices must be a list' }),
    titles: z.array(text('Title', TITLE_MAX), { error: 'Titles must be a list' }),
    notes: z.array(text('Notes', NOTES_MAX), { error: 'Notes must be a list' }),
    deleted: z.array(z.boolean({ error: 'Deleted must be true or false' }), { error: 'Deleted choices must be a list' }),
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
    if (file.print.length !== sources.length) {
      ctx.addIssue({ code: 'custom', path: ['print'], message: 'There must be one print choice for each array' });
    }
    if (file.titles.length !== sources.length) {
      ctx.addIssue({ code: 'custom', path: ['titles'], message: 'There must be one title for each array' });
    }
    if (file.notes.length !== sources.length) {
      ctx.addIssue({ code: 'custom', path: ['notes'], message: 'There must be one note for each array' });
    }
    if (file.deleted.length !== sources.length) {
      ctx.addIssue({ code: 'custom', path: ['deleted'], message: 'There must be one deleted choice for each array' });
    }
    if (file.job.show_date !== '' && !isShowDate(file.job.show_date)) {
      ctx.addIssue({ code: 'custom', path: ['job', 'show_date'], message: 'The show date must be a real date or blank' });
    }
    // The show notes may hold line breaks, nothing else that is not text.
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(file.job.notes)) {
      ctx.addIssue({ code: 'custom', path: ['job', 'notes'], message: 'The show notes cannot hold control characters' });
    }
    file.titles.forEach((t, i) => {
      // eslint-disable-next-line no-control-regex
      if (/[\u0000-\u001f\u007f]/.test(t)) ctx.addIssue({ code: 'custom', path: ['titles', i], message: 'A title cannot hold line breaks or control characters' });
    });
    file.notes.forEach((t, i) => {
      // A note may hold line breaks, nothing else that is not text.
      // eslint-disable-next-line no-control-regex
      if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(t)) ctx.addIssue({ code: 'custom', path: ['notes', i], message: 'A note cannot hold control characters' });
    });
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
      if ((s.fixations?.length ?? 0) > MAX_FIXATIONS_PER_SOURCE) {
        ctx.addIssue({ code: 'custom', path: [...at, 'fixations'], message: `There are more than ${MAX_FIXATIONS_PER_SOURCE} fixations` });
      }
      const long: [string, string][] = [
        ['name', s.name],
        ['bumper', s.bumper ?? ''],
        ['configuration', s.configuration ?? ''],
      ];
      s.fixations?.forEach((f, fi) => {
        if (f.name.length > MAX_TEXT_LENGTH) ctx.addIssue({ code: 'custom', path: [...at, 'fixations', fi, 'name'], message: 'is too long' });
      });
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
