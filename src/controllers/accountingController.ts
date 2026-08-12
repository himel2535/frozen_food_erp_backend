import type { Request, Response } from 'express';
import {
  BalanceSheetLine,
  ProfitLossLine,
  TrialBalanceLine,
} from '../models/extendedResources.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

function tenantFilter(tenantId: string) {
  return { tenantId };
}

const ASSET_SECTIONS = ['current_assets', 'non_current_assets'];
const LIABILITY_SECTIONS = ['current_liabilities', 'long_term_liabilities'];
const EQUITY_SECTIONS = ['equity'];

async function sumBySections(model: typeof BalanceSheetLine, filter: Record<string, unknown>, sections: string[]) {
  const result = await model.aggregate([
    { $match: { ...filter, section: { $in: sections } } },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
  ]);
  return Number(result[0]?.total ?? 0);
}

export const getBalanceSheetSummary = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const [totalAssets, totalLiabilities, totalEquity, lineCount] = await Promise.all([
    sumBySections(BalanceSheetLine, filter, ASSET_SECTIONS),
    sumBySections(BalanceSheetLine, filter, LIABILITY_SECTIONS),
    sumBySections(BalanceSheetLine, filter, EQUITY_SECTIONS),
    BalanceSheetLine.countDocuments(filter),
  ]);
  const difference = Math.abs(totalAssets - (totalLiabilities + totalEquity));
  const grandTotal = totalAssets || totalLiabilities + totalEquity || 1;
  sendSuccess(res, {
    totalAssets,
    totalLiabilities,
    totalEquity,
    difference,
    isBalanced: difference < 0.01,
    assetsPercent: (totalAssets / grandTotal) * 100,
    liabilitiesPercent: (totalLiabilities / grandTotal) * 100,
    equityPercent: (totalEquity / grandTotal) * 100,
    lineCount,
  });
});

export const getProfitLossSummary = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const lines = await ProfitLossLine.find(filter).lean();
  let totalRevenue = 0;
  let totalExpense = 0;
  for (const line of lines) {
    const amount = Number(line.amount ?? 0);
    const section = String(line.section ?? '');
    if (section === 'income') {
      totalRevenue += amount;
      continue;
    }
    if (section === 'other' && String(line.category ?? '') === 'Other Income') {
      totalRevenue += amount;
      continue;
    }
    totalExpense += amount;
  }
  const netProfit = totalRevenue - totalExpense;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  sendSuccess(res, {
    totalRevenue,
    totalExpense,
    netProfit,
    profitMargin,
    lineCount: lines.length,
  });
});

export const getTrialBalanceSummary = asyncHandler(async (req: Request, res: Response) => {
  const filter = tenantFilter(String(req.query.tenantId ?? 'default'));
  const result = await TrialBalanceLine.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalDebit: { $sum: { $ifNull: ['$debit', 0] } },
        totalCredit: { $sum: { $ifNull: ['$credit', 0] } },
        lineCount: { $sum: 1 },
      },
    },
  ]);
  const row = result[0] ?? {};
  const totalDebit = Number(row.totalDebit ?? 0);
  const totalCredit = Number(row.totalCredit ?? 0);
  sendSuccess(res, {
    totalDebit,
    totalCredit,
    difference: Math.abs(totalDebit - totalCredit),
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    lineCount: Number(row.lineCount ?? 0),
  });
});
