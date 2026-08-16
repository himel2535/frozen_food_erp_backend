/** Local calendar YYYY-MM. */
export function currentMonthPrefix(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Inclusive prefix range for YYYY-MM or YYYY-MM-DD string dates (index-friendly vs $regex). */
export function monthPrefixRange(prefix: string): { $gte: string; $lt: string } {
  const [yearRaw, monthRaw] = prefix.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return {
    $gte: prefix,
    $lt: `${nextYear}-${String(nextMonth).padStart(2, '0')}`,
  };
}

export function invoiceMonthMatch(tenantId: string, prefix: string) {
  const range = monthPrefixRange(prefix);
  return {
    tenantId,
    status: { $nin: ['cancelled', 'draft'] },
    $or: [{ issueDate: range }, { date: range }],
  };
}
