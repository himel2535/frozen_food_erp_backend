import { describe, expect, it } from 'vitest';
import {
  compareByRemainingRatio,
  normalizeStockDurationDays,
  stampStockDurationOnCreate,
  stampStockDurationOnUpdate,
  stockDurationMetrics,
} from '../../src/utils/stockDuration.js';

const DAY = 86_400_000;

describe('stockDurationMetrics', () => {
  const now = Date.parse('2026-08-16T00:00:00.000Z');

  it('returns null expected days when duration is unset', () => {
    const metrics = stockDurationMetrics({ stockDurationDays: 0, createdAt: new Date(now - 5 * DAY) }, now);
    expect(metrics.expectedDays).toBeNull();
    expect(metrics.elapsedDays).toBe(5);
    expect(metrics.remainingDays).toBeNull();
    expect(metrics.overdue).toBe(false);
  });

  it('uses startedAt over createdAt for elapsed days', () => {
    const metrics = stockDurationMetrics({
      stockDurationDays: 10,
      createdAt: new Date(now - 20 * DAY),
      stockDurationStartedAt: new Date(now - 3 * DAY),
    }, now);
    expect(metrics.expectedDays).toBe(10);
    expect(metrics.elapsedDays).toBe(3);
    expect(metrics.remainingDays).toBe(7);
    expect(metrics.overdue).toBe(false);
  });

  it('marks overdue when elapsed exceeds expected', () => {
    const metrics = stockDurationMetrics({
      stockDurationDays: 10,
      stockDurationStartedAt: new Date(now - 15 * DAY),
    }, now);
    expect(metrics.elapsedDays).toBe(15);
    expect(metrics.remainingDays).toBe(-5);
    expect(metrics.remainingRatio).toBe(-0.5);
    expect(metrics.overdue).toBe(true);
  });

  it('gives the same remaining ratio for equal time-left percent', () => {
    const tenDay = stockDurationMetrics({
      stockDurationDays: 10,
      stockDurationStartedAt: new Date(now - 9 * DAY),
    }, now);
    const hundredDay = stockDurationMetrics({
      stockDurationDays: 100,
      stockDurationStartedAt: new Date(now - 90 * DAY),
    }, now);
    expect(tenDay.remainingRatio).toBe(0.1);
    expect(hundredDay.remainingRatio).toBe(0.1);
  });
});

describe('compareByRemainingRatio', () => {
  it('puts overdue first, then higher remaining percent, equal percents together', () => {
    const rows = [
      { name: 'B-90pct', remainingRatio: 0.9 },
      { name: 'A-10pct', remainingRatio: 0.1 },
      { name: 'C-10pct', remainingRatio: 0.1 },
      { name: 'Overdue', remainingRatio: -0.2 },
      { name: 'No target', remainingRatio: null },
    ];
    rows.sort(compareByRemainingRatio);
    expect(rows.map((r) => r.name)).toEqual(['Overdue', 'B-90pct', 'A-10pct', 'C-10pct', 'No target']);
  });
});

describe('stampStockDurationOnUpdate', () => {
  it('resets startedAt only when quantity increases', () => {
    const previous = { quantity: 10, stockDurationStartedAt: 'old' };
    const increased = { quantity: 25 };
    stampStockDurationOnUpdate(previous, increased, 'quantity');
    expect(increased.stockDurationStartedAt).toBeInstanceOf(Date);

    const decreased = { quantity: 4, stockDurationStartedAt: 'should-drop' };
    stampStockDurationOnUpdate(previous, decreased, 'quantity');
    expect(decreased.stockDurationStartedAt).toBeUndefined();
  });
});

describe('stampStockDurationOnCreate', () => {
  it('normalizes days and stamps startedAt', () => {
    const payload: Record<string, unknown> = { stockDurationDays: '12' };
    stampStockDurationOnCreate(payload);
    expect(payload.stockDurationDays).toBe(12);
    expect(payload.stockDurationStartedAt).toBeInstanceOf(Date);
  });
});

describe('normalizeStockDurationDays', () => {
  it('floors negatives and junk to 0', () => {
    expect(normalizeStockDurationDays(-3)).toBe(0);
    expect(normalizeStockDurationDays('abc')).toBe(0);
    expect(normalizeStockDurationDays(10.9)).toBe(10);
  });
});
