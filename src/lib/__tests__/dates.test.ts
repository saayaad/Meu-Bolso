import { describe, it, expect } from 'vitest';
import {
  parseLocalDate,
  formatLocalDate,
  formatDisplayDate,
  addDays,
  addMonths,
  isPastDue,
  isDueToday,
  isSameMonth,
  getPreviousMonth,
  getNextMonth,
} from '../dates';

describe('lib/dates unit tests', () => {
  it('parses and formats local date string without timezone shift', () => {
    const parsed = parseLocalDate('2026-10-20');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(9); // 0-indexed October
    expect(parsed.getDate()).toBe(20);

    const formatted = formatLocalDate(parsed);
    expect(formatted).toBe('2026-10-20');
  });

  it('formats display date in pt-BR DD/MM/YYYY', () => {
    expect(formatDisplayDate('2026-10-20')).toBe('20/10/2026');
  });

  it('adds days correctly across month boundary', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('adds months and clamps to end of month for leap/short months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-10-15', 2)).toBe('2026-12-15');
  });

  it('detects past due date', () => {
    expect(isPastDue('2026-10-10', '2026-10-20')).toBe(true);
    expect(isPastDue('2026-10-25', '2026-10-20')).toBe(false);
  });

  it('detects due today', () => {
    expect(isDueToday('2026-10-20', '2026-10-20')).toBe(true);
  });

  it('checks same month correctly', () => {
    expect(isSameMonth('2026-10-20', '2026-10')).toBe(true);
    expect(isSameMonth('2026-11-01', '2026-10')).toBe(false);
  });

  it('gets previous and next month strings', () => {
    expect(getPreviousMonth('2026-01')).toBe('2025-12');
    expect(getNextMonth('2026-12')).toBe('2027-01');
  });
});
