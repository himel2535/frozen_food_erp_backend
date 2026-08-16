const MS_PER_DAY = 86_400_000;

export type StockDurationMetrics = {
  expectedDays: number | null;
  elapsedDays: number;
  remainingDays: number | null;
  /** remainingDays / expectedDays; negative when overdue. Null when no target. */
  remainingRatio: number | null;
  overdue: boolean;
};

function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : NaN;
  }
  return NaN;
}

/** Expected duration vs days elapsed since last restock (or createdAt). */
export function stockDurationMetrics(
  row: Record<string, unknown>,
  now = Date.now(),
): StockDurationMetrics {
  const expected = Math.max(0, Math.floor(Number(row.stockDurationDays ?? 0) || 0));
  const startMs = toTime(row.stockDurationStartedAt ?? row.createdAt);
  const elapsedDays = Number.isFinite(startMs) ? Math.max(0, Math.floor((now - startMs) / MS_PER_DAY)) : 0;
  if (expected <= 0) {
    return { expectedDays: null, elapsedDays, remainingDays: null, remainingRatio: null, overdue: false };
  }
  const remainingDays = expected - elapsedDays;
  return {
    expectedDays: expected,
    elapsedDays,
    remainingDays,
    remainingRatio: remainingDays / expected,
    overdue: elapsedDays > expected,
  };
}

type DurationSortRow = {
  remainingRatio: number | null;
  name?: string;
};

/** Overdue first; then more time-left % first so 10d/9 elapsed sits after 100d/10 elapsed. */
export function compareByRemainingRatio(a: DurationSortRow, b: DurationSortRow): number {
  const ar = a.remainingRatio;
  const br = b.remainingRatio;
  if (ar == null && br == null) return String(a.name ?? '').localeCompare(String(b.name ?? ''));
  if (ar == null) return 1;
  if (br == null) return -1;
  const aOver = ar < 0;
  const bOver = br < 0;
  if (aOver !== bOver) return aOver ? -1 : 1;
  if (ar !== br) return aOver ? ar - br : br - ar;
  return String(a.name ?? '').localeCompare(String(b.name ?? ''));
}

export function normalizeStockDurationDays(value: unknown): number {
  const n = Math.floor(Number(value ?? 0) || 0);
  return n > 0 ? n : 0;
}

export function stampStockDurationOnCreate(payload: Record<string, unknown>): void {
  payload.stockDurationDays = normalizeStockDurationDays(payload.stockDurationDays);
  if (!payload.stockDurationStartedAt) {
    payload.stockDurationStartedAt = new Date();
  }
}

/** Reset the duration clock only when on-hand quantity increases. */
export function stampStockDurationOnUpdate(
  previous: Record<string, unknown>,
  payload: Record<string, unknown>,
  qtyField: string,
): void {
  delete payload.stockDurationStartedAt;
  if ('stockDurationDays' in payload) {
    payload.stockDurationDays = normalizeStockDurationDays(payload.stockDurationDays);
  }
  const prevQty = Number(previous[qtyField] ?? 0);
  const nextQty = payload[qtyField] != null ? Number(payload[qtyField]) : prevQty;
  if (nextQty > prevQty) {
    payload.stockDurationStartedAt = new Date();
  }
}
