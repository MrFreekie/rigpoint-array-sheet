// Zod schema for saved files (*.arraysheet.json, format "arraysheet/14").
// Every opened file is untrusted: it is validated here before anything reads it.

import { z } from 'zod';
import { CART_SIZE_MAX, CART_SIZES_MAX, CART_TYPE_MAX } from '../engine/carts';
import { SHAPES, SYMBOL_VALUE_MAX } from '../engine/markers';
import { PATCH_DIGITS } from '../engine/patch';
import { UNDERLAY_MAX_EDGES, UNDERLAY_MAX_LAYERS, UNDERLAY_NAME_MAX, UNDERLAY_STEPS, unpackEdges } from '../engine/underlay';
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
export const FORMAT_VERSION = 14;
export const FORMAT = `${FORMAT_NAME}/${FORMAT_VERSION}`;

/** The longest Origin (P0) note the file accepts. */
export const ORIGIN_MAX = 100;
/** The longest card title and the longest note for one array. */
export const TITLE_MAX = 60;
export const NOTES_MAX = 300;
/** The longest note for the whole show. */
export const SHOW_NOTES_MAX = 500;

const MarkerSchema = z.object({
  shape: z.enum(SHAPES, { error: 'A pickup symbol must be one of the four shapes' }),
});

const SymbolValueSchema = z
  .string({ error: 'The value of a symbol must be text' })
  .min(1, { error: 'The value of a symbol cannot be blank' })
  .max(SYMBOL_VALUE_MAX, { error: `The value of a symbol is longer than ${SYMBOL_VALUE_MAX} characters` });

const CartSizeSchema = z.object({
  type: z
    .string({ error: 'A cart size needs the type of enclosure as text' })
    .min(1, { error: 'A cart size needs the type of enclosure' })
    .max(CART_TYPE_MAX, { error: 'The type of a cart size is too long' }),
  size: z
    .number({ error: 'A cart size must be a number' })
    .int({ error: 'A cart size must be a whole number' })
    .min(1, { error: `A cart size must be between 1 and ${CART_SIZE_MAX}` })
    .max(CART_SIZE_MAX, { error: `A cart size must be between 1 and ${CART_SIZE_MAX}` }),
});

const CartSchema = z.object({
  manual: z.boolean({ error: 'Carts must be set by hand or automatic' }),
  breaks: z.array(z.number({ error: 'A cart break must be a number' }).int({ error: 'A cart break must be a whole number' }), { error: 'Cart breaks must be a list' }),
});

const PatchValueSchema = z.enum(['', ...PATCH_DIGITS], { error: 'A feeder or a way must be one digit, 0 to 9, or blank' });
const PatchRowSchema = z.object({ feeder: PatchValueSchema, way: PatchValueSchema });

/** The longest packed line list for one shade of one layer: far more than the line limit needs. */
const PACKED_MAX = 2_000_000;

const UnderlaySchema = z
  .object({
    layers: z.array(
      z.object({
        name: z.string({ error: 'A venue layer name must be text' }).min(1, { error: 'A venue layer needs a name' }).max(UNDERLAY_NAME_MAX, { error: 'A venue layer name is too long' }),
        hidden: z.boolean({ error: 'A venue layer must be shown or hidden' }),
        shades: z
          .array(
            z.object({
              step: z.number({ error: 'A venue shade must be a number' }).int({ error: 'A venue shade must be a whole number' }).min(0, { error: 'A venue shade is out of range' }).max(UNDERLAY_STEPS - 1, { error: 'A venue shade is out of range' }),
              edges: z.string({ error: 'Venue lines must be text' }).max(PACKED_MAX, { error: 'The venue lines are too long' }),
            }),
            { error: 'Venue shades must be a list' },
          )
          .max(UNDERLAY_STEPS, { error: 'A venue layer has too many shades' }),
      }),
      { error: 'Venue layers must be a list' },
    ).max(UNDERLAY_MAX_LAYERS, { error: 'The venue has too many layers' }),
  })
  .nullable();

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
    plot: z.array(z.boolean({ error: 'Include on the rigging plot must be true or false' }), { error: 'The choices of what is on the rigging plot must be a list' }),
    print_plot: z.boolean({ error: 'Print rigging plot must be true or false' }),
    markers: z.array(z.object({ front: MarkerSchema, rear: MarkerSchema }), { error: 'Pickup symbols must be a list' }),
    symbol_values: z.object({ two: SymbolValueSchema, one: SymbolValueSchema, half: SymbolValueSchema, quarter: SymbolValueSchema }),
    patch: z.array(z.array(PatchRowSchema, { error: 'The cable patch of an array must be a list' }), { error: 'Cable patches must be a list' }),
    cart_sizes: z.array(CartSizeSchema, { error: 'Cart sizes must be a list' }).max(CART_SIZES_MAX, { error: `There are more than ${CART_SIZES_MAX} cart sizes` }),
    carts: z.array(CartSchema, { error: 'Carts must be a list' }),
    underlay: UnderlaySchema,
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
    if (file.plot.length !== sources.length) {
      ctx.addIssue({ code: 'custom', path: ['plot'], message: 'There must be one rigging plot choice for each array' });
    }
    if (file.markers.length !== sources.length) {
      ctx.addIssue({ code: 'custom', path: ['markers'], message: 'There must be one pair of pickup symbols for each array' });
    }
    if (file.patch.length !== sources.length) {
      ctx.addIssue({ code: 'custom', path: ['patch'], message: 'There must be one cable patch for each array' });
    } else {
      file.patch.forEach((rows, i) => {
        const count = sources[i]?.cabinets.length ?? 0;
        if (rows.length !== count) ctx.addIssue({ code: 'custom', path: ['patch', i], message: `The cable patch of array ${i + 1} must have one feeder and way for each of its ${count} enclosures` });
      });
    }
    const seenTypes = new Set<string>();
    file.cart_sizes.forEach((c, i) => {
      const key = c.type.trim().toLowerCase();
      // eslint-disable-next-line no-control-regex
      if (c.type.trim() === '' || /[\u0000-\u001f\u007f]/.test(c.type)) ctx.addIssue({ code: 'custom', path: ['cart_sizes', i, 'type'], message: 'The type of a cart size cannot be blank or hold control characters' });
      else if (seenTypes.has(key)) ctx.addIssue({ code: 'custom', path: ['cart_sizes', i, 'type'], message: `The cart size for ${c.type} is listed twice` });
      seenTypes.add(key);
    });
    if (file.carts.length !== sources.length) {
      ctx.addIssue({ code: 'custom', path: ['carts'], message: 'There must be one set of carts for each array' });
    } else {
      file.carts.forEach((c, i) => {
        const count = sources[i]?.cabinets.length ?? 0;
        if (!c.manual && c.breaks.length > 0) ctx.addIssue({ code: 'custom', path: ['carts', i], message: `The carts of array ${i + 1} are automatic, so they cannot list breaks` });
        c.breaks.forEach((b, n) => {
          if (b < 1 || b >= count) ctx.addIssue({ code: 'custom', path: ['carts', i, 'breaks', n], message: `A cart break of array ${i + 1} must fall between two of its ${count} enclosures` });
          else if (n > 0 && b <= (c.breaks[n - 1] as number)) ctx.addIssue({ code: 'custom', path: ['carts', i, 'breaks', n], message: `The cart breaks of array ${i + 1} must run from the top down, once each` });
        });
      });
    }
    for (const shape of SHAPES) {
      // eslint-disable-next-line no-control-regex
      if (/[\u0000-\u001f\u007f]/.test(file.symbol_values[shape])) ctx.addIssue({ code: 'custom', path: ['symbol_values', shape], message: 'The value of a symbol cannot hold line breaks or control characters' });
    }
    if (file.underlay) {
      let edges = 0;
      file.underlay.layers.forEach((layer, li) =>
        layer.shades.forEach((shade, si) => {
          const lines = unpackEdges(shade.edges);
          if (lines === null) ctx.addIssue({ code: 'custom', path: ['underlay', 'layers', li, 'shades', si, 'edges'], message: 'The venue lines could not be read' });
          else edges += lines.length / 4;
        }),
      );
      if (edges > UNDERLAY_MAX_EDGES) ctx.addIssue({ code: 'custom', path: ['underlay'], message: `The venue has more than ${UNDERLAY_MAX_EDGES} lines` });
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
