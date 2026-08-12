import type { Request, Response } from 'express';
import { Employee } from '../models/index.js';
import { SalarySheetEntry } from '../models/extendedResources.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

function tenantFilter(tenantId: string) {
  return { tenantId };
}

export const getSalarySheetSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenantId ?? 'default');
  const filter: Record<string, unknown> = tenantFilter(tenantId);
  const period = String(req.query.period ?? '').trim();
  if (period) filter.period = period;

  const result = await SalarySheetEntry.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        entryCount: { $sum: 1 },
        presentDays: { $sum: { $ifNull: ['$presentDays', 0] } },
        absentDays: { $sum: { $ifNull: ['$absentDays', 0] } },
        otHours: { $sum: { $ifNull: ['$otHours', 0] } },
        netPayable: {
          $sum: {
            $ifNull: ['$netPayable', { $ifNull: ['$netPay', 0] }],
          },
        },
      },
    },
  ]);
  const row = result[0] ?? {};
  const employeeCount = await Employee.countDocuments(tenantFilter(tenantId));
  sendSuccess(res, {
    employeeCount,
    entryCount: Number(row.entryCount ?? 0),
    presentDays: Number(row.presentDays ?? 0),
    absentDays: Number(row.absentDays ?? 0),
    otHours: Number(row.otHours ?? 0),
    netPayable: Number(row.netPayable ?? 0),
    period: period || null,
  });
});
