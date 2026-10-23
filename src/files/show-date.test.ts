import { describe, expect, it } from 'vitest';
import { isShowDate, showDateText } from './show-date';

describe('show date', () => {
  it('accepts a real calendar date written YYYY-MM-DD', () => {
    expect(isShowDate('2026-10-23')).toBe(true);
    expect(isShowDate('2028-02-29')).toBe(true);
    expect(isShowDate('2026-12-31')).toBe(true);
  });

  it('refuses a date that does not exist, or is not written that way', () => {
    for (const bad of ['', '2026-02-29', '2026-13-01', '2026-00-10', '2026-10-00', '2026-04-31', '23/10/2026', '2026-1-5', '26-10-23', ' 2026-10-23', '2026-10-23T00:00', '1800-01-01']) {
      expect(isShowDate(bad), bad).toBe(false);
    }
  });

  it('prints UK style, day then month then year, and nothing for a blank or bad date', () => {
    expect(showDateText('2026-10-23')).toBe('23/10/2026');
    expect(showDateText('2026-01-05')).toBe('05/01/2026');
    expect(showDateText('')).toBe('');
    expect(showDateText('2026-02-30')).toBe('');
  });
});
