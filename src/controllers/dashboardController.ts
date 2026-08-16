import type { Request, Response } from 'express';
import {
  Customer,
  Invoice,
  Lead,
  SalesOrder,
  Product,
  RawMaterial,
  SemiFinishedProduct,
  FinishedGood,
} from '../models/index.js';
import { PurchaseOrder, ProductionOrder } from '../models/extendedResources.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

function tenantFilter(tenantId: string) {
  return { tenantId };
}

/** Stock still on hand, but at or below reorder level (or min stock if reorder is unset). */
function productLowStockFilter() {
  const threshold = {
    $cond: [
      { $gt: [{ $ifNull: ['$reorderLevel', 0] }, 0] },
      { $ifNull: ['$reorderLevel', 0] },
      { $ifNull: ['$minStock', 0] },
    ],
  };
  return {
    $expr: {
      $and: [
        { $gt: [{ $ifNull: ['$stock', 0] }, 0] },
        { $gt: [threshold, 0] },
        { $lte: [{ $ifNull: ['$stock', 0] }, threshold] },
      ],
    },
  };
}

/** Local calendar YYYY-MM — invoice issueDate/date are date strings, not ISO datetimes. */
function currentMonthPrefix() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

/** Dashboard KPI aggregates — computed in MongoDB instead of shipping full collections. */
export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenantId ?? 'default');
  const filter = tenantFilter(tenantId);
  const monthPrefix = currentMonthPrefix();

  const [
    salesSummary,
    monthSales,
    pendingSales,
    openLeads,
    customerDue,
    supplierDue,
    productionPending,
    productionPendingQty,
    productionCompleted,
    purchaseSummary,
    purchasePending,
    lowStockProducts,
    lowStockRm,
    lowStockSf,
    lowStockFg,
    inventoryValue,
  ] = await Promise.all([
    SalesOrder.aggregate([
      { $match: filter },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: { $ifNull: ['$total', 0] } } } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          ...filter,
          status: { $nin: ['cancelled', 'draft'] },
          $or: [
            { issueDate: { $regex: `^${monthPrefix}` } },
            { date: { $regex: `^${monthPrefix}` } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$amount', { $ifNull: ['$total', 0] }] } },
        },
      },
    ]),
    SalesOrder.countDocuments({ ...filter, status: { $in: ['confirmed', 'processing', 'draft', 'Confirmed', 'Processing', 'Draft'] } }),
    Lead.aggregate([
      { $match: { ...filter, status: { $nin: ['won', 'lost', 'closed', 'Won', 'Lost', 'Closed'] } } },
      { $group: { _id: null, count: { $sum: 1 }, pipelineValue: { $sum: { $ifNull: ['$expectedValue', 0] } } } },
    ]),
    Customer.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalDue: {
            $sum: { $ifNull: ['$totalDue', { $ifNull: ['$due', 0] }] },
          },
          withDue: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ['$totalDue', { $ifNull: ['$due', 0] }] }, 0] }, 1, 0],
            },
          },
        },
      },
    ]),
    PurchaseOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalDue: { $sum: { $ifNull: ['$due', { $ifNull: ['$balance', 0] }] } },
          withDue: {
            $sum: {
              $cond: [{ $gt: [{ $ifNull: ['$due', { $ifNull: ['$balance', 0] }] }, 0] }, 1, 0],
            },
          },
        },
      },
    ]),
    ProductionOrder.countDocuments({ ...filter, status: { $in: ['Planned', 'In Progress'] } }),
    ProductionOrder.aggregate([
      { $match: { ...filter, status: { $in: ['Planned', 'In Progress'] } } },
      { $group: { _id: null, qty: { $sum: { $ifNull: ['$plannedQuantity', 0] } } } },
    ]),
    ProductionOrder.aggregate([
      { $match: { ...filter, status: 'Completed' } },
      { $group: { _id: null, count: { $sum: 1 }, qty: { $sum: { $ifNull: ['$actualQuantity', { $ifNull: ['$plannedQuantity', 0] }] } } } },
    ]),
    PurchaseOrder.aggregate([
      { $match: filter },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: { $ifNull: ['$total', 0] } } } },
    ]),
    PurchaseOrder.countDocuments({ ...filter, status: { $in: ['Draft', 'Sent'] } }),
    Product.countDocuments({ ...filter, ...productLowStockFilter() }),
    RawMaterial.countDocuments({ ...filter, $expr: { $lte: ['$stock', { $ifNull: ['$reorderLevel', 0] }] } }),
    SemiFinishedProduct.countDocuments({ ...filter, $expr: { $lte: ['$stock', { $ifNull: ['$reorderLevel', 0] }] } }),
    FinishedGood.countDocuments({ ...filter, $expr: { $lte: ['$stock', { $ifNull: ['$reorderLevel', 0] }] } }),
    Promise.all([
      RawMaterial.aggregate([{ $match: filter }, { $group: { _id: null, v: { $sum: { $multiply: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$cost', 0] }] } } } }]),
      SemiFinishedProduct.aggregate([{ $match: filter }, { $group: { _id: null, v: { $sum: { $multiply: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$cost', 0] }] } } } }]),
      FinishedGood.aggregate([{ $match: filter }, { $group: { _id: null, v: { $sum: { $multiply: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$price', { $ifNull: ['$cost', 0] }] }] } } } }]),
    ]),
  ]);

  const rmVal = inventoryValue[0]?.[0]?.v ?? 0;
  const sfVal = inventoryValue[1]?.[0]?.v ?? 0;
  const fgVal = inventoryValue[2]?.[0]?.v ?? 0;

  sendSuccess(res, {
    salesSummary: {
      count: salesSummary[0]?.count ?? 0,
      total: salesSummary[0]?.total ?? 0,
    },
    monthRevenue: monthSales[0]?.revenue ?? 0,
    monthSalesCount: monthSales[0]?.count ?? 0,
    pendingSales,
    openLeadsCount: openLeads[0]?.count ?? 0,
    openLeadsValue: openLeads[0]?.pipelineValue ?? 0,
    customerDue: customerDue[0]?.totalDue ?? 0,
    customerDueCount: customerDue[0]?.withDue ?? 0,
    supplierDue: supplierDue[0]?.totalDue ?? 0,
    supplierDueCount: supplierDue[0]?.withDue ?? 0,
    pendingProduction: productionPending,
    pendingProductionQty: productionPendingQty[0]?.qty ?? 0,
    productionCompleted: productionCompleted[0]?.count ?? 0,
    productionQty: productionCompleted[0]?.qty ?? 0,
    purchaseSummary: {
      count: purchaseSummary[0]?.count ?? 0,
      total: purchaseSummary[0]?.total ?? 0,
    },
    pendingPurchase: purchasePending,
    lowStock: lowStockProducts + lowStockRm + lowStockSf + lowStockFg,
    rmStockValue: rmVal,
    sfStockValue: sfVal,
    fgStockValue: fgVal,
    totalInventoryValue: rmVal + sfVal + fgVal,
  });
});
