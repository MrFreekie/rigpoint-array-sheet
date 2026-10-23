import { describe, expect, it } from 'vitest';
import { parseFixture } from '../testing/fixtures';
import { formatIssues } from './errors';
import { ParseResultSchema } from './report';

describe('ParseResultSchema', () => {
  it.each(['a', 'b', 'e'] as const)('accepts what the engine returns for report %s', (name) => {
    expect(ParseResultSchema.safeParse(parseFixture(name)).success).toBe(true);
  });

  it('names the array and field when a figure is wrong', () => {
    const bad = structuredClone(parseFixture('a'));
    (bad.report.sources[2]!.cabinets[1] as unknown as Record<string, unknown>)['topZ'] = 'high';
    const parsed = ParseResultSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatIssues(parsed.error)).toEqual(['Array 3, Enclosures, entry 2, Top height: must be a number']);
    }
  });

  it('names the array and field when a fixation is wrong', () => {
    const bad = structuredClone(parseFixture('e'));
    (bad.report.sources[10]!.fixations![1]!.at as unknown as Record<string, unknown>)['y'] = 'far';
    const parsed = ParseResultSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(formatIssues(parsed.error)).toEqual(['Array 11, Fixations, entry 2, at, y: must be a number']);
  });

  it('rejects a weight that is not a number', () => {
    const bad = structuredClone(parseFixture('b'));
    (bad.report.sources[0]!.weights as unknown as Record<string, unknown>)['total'] = 'heavy';
    const parsed = ParseResultSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(formatIssues(parsed.error)[0]).toMatch(/^Array 1, Weights, Total weight: /);
  });

  it('limits how many problems it lists', () => {
    const parsed = ParseResultSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const lines = formatIssues(parsed.error, 1);
      expect(lines).toHaveLength(2);
      expect(lines[1]).toMatch(/^…and \d+ more problems?\.$/);
    }
  });
});
