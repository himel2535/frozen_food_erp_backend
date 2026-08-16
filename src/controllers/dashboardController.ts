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
import {
  productLowStockFilter,
  rawMaterialLowStockFilter,
  quantityMinStockLowStockFilter,
} from '../utils/lowStockMongo.js';
import { currentMonthPrefix, invoiceMonthMatch } from '../utils/monthPrefix.js';
import { formatTimingLegs, timeNamed } from '../utils/timing.js';

function tenantFilter(tenantId: string) {
  return { tenantId };
}

function inventoryValuePipeline(filter: Record<string, unknown>, qtyField: string, valueFields: string[]) {
  const unitValue = valueFields.reduceRight<unknown>((acc, field) => ({ $ifNull: [`$${field}`, acc] }), 0);
  return [
    { $match: filter },
    {
      $group: {
        _id: null,
        v: { $sum: { $multiply: [{ $ifNull: [`$${qtyField}`, 0] }, unitValue] } },
      },
    },
  ];
}

/** Dashboard KPI aggregates — computed in MongoDB instead of shipping full collections. */
export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenantId ?? 'default');
  const filter = tenantFilter(tenantId);
  const monthPrefix = currentMonthPrefix();
  const started = Date.now();
  const legs: Record<string, number> = {};

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
    timeNamed('salesAgg', () => SalesOrder.aggregate([
      { $match: filter },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: { $ifNull: ['$total', 0] } } } },
    ]), legs),
    timeNamed('monthInvoices', () => Invoice.aggregate([
      { $match: invoiceMonthMatch(tenantId, monthPrefix) },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$amount', { $ifNull: ['$total', 0] }] } },
        },
      },
    ]), legs),
    timeNamed('pendingSales', () => SalesOrder.countDocuments({
      ...filter,
      status: { $in: ['confirmed', 'processing', 'draft', 'Confirmed', 'Processing', 'Draft'] },
    }), legs),
    timeNamed('openLeads', () => Lead.aggregate([
      { $match: { ...filter, status: { $nin: ['won', 'lost', 'closed', 'Won', 'Lost', 'Closed'] } } },
      { $group: { _id: null, count: { $sum: 1 }, pipelineValue: { $sum: { $ifNull: ['$expectedValue', 0] } } } },
    ]), legs),
    timeNamed('customerDue', () => Customer.aggregate([
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
    ]), legs),
    timeNamed('supplierDue', () => PurchaseOrder.aggregate([
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
    ]), legs),
    timeNamed('productionPending', () => ProductionOrder.countDocuments({
      ...filter,
      status: { $in: ['Planned', 'In Progress'] },
    }), legs),
    timeNamed('productionPendingQty', () => ProductionOrder.aggregate([
      { $match: { ...filter, status: { $in: ['Planned', 'In Progress'] } } },
      { $group: { _id: null, qty: { $sum: { $ifNull: ['$plannedQuantity', 0] } } } },
    ]), legs),
    timeNamed('productionCompleted', () => ProductionOrder.aggregate([
      { $match: { ...filter, status: 'Completed' } },
      { $group: { _id: null, count: { $sum: 1 }, qty: { $sum: { $ifNull: ['$actualQuantity', { $ifNull: ['$plannedQuantity', 0] }] } } } },
    ]), legs),
    timeNamed('purchaseSummary', () => PurchaseOrder.aggregate([
      { $match: filter },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: { $ifNull: ['$total', 0] } } } },
    ]), legs),
    timeNamed('pendingPurchase', () => PurchaseOrder.countDocuments({
      ...filter,
      status: { $in: ['Draft', 'Sent'] },
    }), legs),
    timeNamed('lowStockProducts', () => Product.countDocuments({ ...filter, ...productLowStockFilter() }), legs),
    timeNamed('lowStockRm', () => RawMaterial.countDocuments({ ...filter, ...rawMaterialLowStockFilter() }), legs),
    timeNamed('lowStockSf', () => SemiFinishedProduct.countDocuments({ ...filter, ...quantityMinStockLowStockFilter() }), legs),
    timeNamed('lowStockFg', () => FinishedGood.countDocuments({ ...filter, ...quantityMinStockLowStockFilter() }), legs),
    timeNamed('inventoryValue', () => Promise.all([
      RawMaterial.aggregate(inventoryValuePipeline(filter, 'quantity', ['cost', 'price', 'supplierPrice'])),
      SemiFinishedProduct.aggregate(inventoryValuePipeline(filter, 'quantity', ['avgCost', 'cost'])),
      FinishedGood.aggregate(inventoryValuePipeline(filter, 'quantity', ['avgCost', 'price', 'cost'])),
    ]), legs),
  ]);

  const rmVal = inventoryValue[0]?.[0]?.v ?? 0;
  const sfVal = inventoryValue[1]?.[0]?.v ?? 0;
  const fgVal = inventoryValue[2]?.[0]?.v ?? 0;
  const totalMs = Date.now() - started;
  console.log(`[timing] GET /dashboard/summary DB ${formatTimingLegs(legs)} total=${totalMs}ms`);

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
