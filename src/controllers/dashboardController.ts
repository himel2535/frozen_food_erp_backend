import type { Request, Response } from 'express';
import {
  Customer,
  Invoice,
  Lead,
  SalesOrder,
  Product,
  PosTransaction,
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

type Filter = { tenantId: string };
type Legs = Record<string, number>;
type SummaryScope = 'kpi' | 'extra' | 'full';

function tenantFilter(tenantId: string): Filter {
  return { tenantId };
}

function parseScope(raw: unknown): SummaryScope {
  const value = String(raw ?? 'full').toLowerCase();
  if (value === 'kpi' || value === 'extra') return value;
  return 'full';
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

async function loadKpiSummary(tenantId: string, filter: Filter, monthPrefix: string, legs: Legs) {
  const [
    monthSales,
    pendingSales,
    openLeads,
    customerDue,
    productionPending,
    productionPendingQty,
  ] = await Promise.all([
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
    timeNamed('productionPending', () => ProductionOrder.countDocuments({
      ...filter,
      status: { $in: ['Planned', 'In Progress'] },
    }), legs),
    timeNamed('productionPendingQty', () => ProductionOrder.aggregate([
      { $match: { ...filter, status: { $in: ['Planned', 'In Progress'] } } },
      { $group: { _id: null, qty: { $sum: { $ifNull: ['$plannedQuantity', 0] } } } },
    ]), legs),
  ]);

  return {
    monthRevenue: monthSales[0]?.revenue ?? 0,
    monthSalesCount: monthSales[0]?.count ?? 0,
    pendingSales,
    openLeadsCount: openLeads[0]?.count ?? 0,
    openLeadsValue: openLeads[0]?.pipelineValue ?? 0,
    customerDue: customerDue[0]?.totalDue ?? 0,
    customerDueCount: customerDue[0]?.withDue ?? 0,
    pendingProduction: productionPending,
    pendingProductionQty: productionPendingQty[0]?.qty ?? 0,
  };
}

async function loadExtraSummary(filter: Filter, legs: Legs) {
  const [
    salesSummary,
    supplierDue,
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

  return {
    salesSummary: {
      count: salesSummary[0]?.count ?? 0,
      total: salesSummary[0]?.total ?? 0,
    },
    purchaseSummary: {
      count: purchaseSummary[0]?.count ?? 0,
      total: purchaseSummary[0]?.total ?? 0,
    },
    supplierDue: supplierDue[0]?.totalDue ?? 0,
    supplierDueCount: supplierDue[0]?.withDue ?? 0,
    productionCompleted: productionCompleted[0]?.count ?? 0,
    productionQty: productionCompleted[0]?.qty ?? 0,
    pendingPurchase: purchasePending,
    lowStock: lowStockProducts + lowStockRm + lowStockSf + lowStockFg,
    rmStockValue: rmVal,
    sfStockValue: sfVal,
    fgStockValue: fgVal,
    totalInventoryValue: rmVal + sfVal + fgVal,
  };
}

const CANCELLED_OR_DRAFT = ['draft', 'cancelled', 'canceled', 'Draft', 'Cancelled', 'Canceled'];

function lineUnwindPipeline(tenantId: string) {
  return [
    { $match: { tenantId, status: { $nin: CANCELLED_OR_DRAFT } } },
    { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        sku: {
          $toLower: {
            $trim: {
              input: {
                $toString: { $ifNull: ['$items.sku', { $ifNull: ['$items.productId', ''] }] },
              },
            },
          },
        },
        name: {
          $trim: {
            input: { $toString: { $ifNull: ['$items.name', { $ifNull: ['$items.description', ''] }] } },
          },
        },
        qty: { $ifNull: ['$items.qty', 0] },
        revenue: {
          $cond: [
            { $gt: [{ $ifNull: ['$items.total', 0] }, 0] },
            { $ifNull: ['$items.total', 0] },
            {
              $multiply: [
                { $ifNull: ['$items.qty', 0] },
                { $ifNull: ['$items.rate', { $ifNull: ['$items.price', 0] }] },
              ],
            },
          ],
        },
        imageUrl: { $ifNull: ['$items.imageUrl', ''] },
      },
    },
  ];
}

/** Ranked products from SO/invoice/POS line items — keeps list endpoints item-free. */
export const getDashboardTopProducts = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenantId ?? 'default');
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
  const started = Date.now();
  const linePipeline = lineUnwindPipeline(tenantId);

  const [salesLines, invoiceLines, posLines, products] = await Promise.all([
    SalesOrder.aggregate(linePipeline),
    Invoice.aggregate(linePipeline),
    PosTransaction.aggregate(linePipeline),
    Product.find({ tenantId }).select('sku legacyId name category imageUrl').lean(),
  ]);

  const catalog = new Map<string, { name: string; category: string; imageUrl: string; identity: string }>();
  const indexCatalog = (
    key: unknown,
    row: Record<string, unknown>,
  ) => {
    const normalized = String(key ?? '').trim().toLowerCase();
    if (!normalized || catalog.has(normalized)) return;
    catalog.set(normalized, {
      identity: normalized,
      name: String(row.name ?? 'Product').trim() || 'Product',
      category: String(row.category ?? '').trim() || '—',
      imageUrl: String(row.imageUrl ?? ''),
    });
  };
  for (const product of products as Array<Record<string, unknown>>) {
    indexCatalog(product.sku, product);
    indexCatalog(product.legacyId, product);
    indexCatalog(product.name, product);
  }

  type Acc = { name: string; category: string; sold: number; revenue: number; imageUrl: string };
  const map = new Map<string, Acc>();
  for (const line of [...salesLines, ...invoiceLines, ...posLines] as Array<{
    sku?: string;
    name?: string;
    qty?: number;
    revenue?: number;
    imageUrl?: string;
  }>) {
    const qty = Number(line.qty ?? 0);
    const revenue = Number(line.revenue ?? 0);
    if (qty <= 0 && revenue <= 0) continue;
    const hit = catalog.get(String(line.sku ?? '').trim().toLowerCase())
      ?? catalog.get(String(line.name ?? '').trim().toLowerCase());
    if (!hit) continue;
    const existing = map.get(hit.identity) ?? {
      name: hit.name,
      category: hit.category,
      sold: 0,
      revenue: 0,
      imageUrl: hit.imageUrl,
    };
    existing.sold += qty;
    existing.revenue += revenue;
    if (!existing.imageUrl && line.imageUrl) existing.imageUrl = String(line.imageUrl);
    map.set(hit.identity, existing);
  }

  const rows = Array.from(map.values())
    .filter((row) => row.sold > 0 || row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue || b.sold - a.sold)
    .slice(0, limit);

  console.log(`[timing] GET /dashboard/top-products total=${Date.now() - started}ms rows=${rows.length}`);
  sendSuccess(res, rows);
});

/** Dashboard KPI aggregates — computed in MongoDB instead of shipping full collections. */
export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenantId ?? 'default');
  const scope = parseScope(req.query.scope);
  const filter = tenantFilter(tenantId);
  const monthPrefix = currentMonthPrefix();
  const started = Date.now();
  const legs: Legs = {};

  let payload: Record<string, unknown>;
  if (scope === 'kpi') {
    payload = await loadKpiSummary(tenantId, filter, monthPrefix, legs);
  } else if (scope === 'extra') {
    payload = await loadExtraSummary(filter, legs);
  } else {
    const kpiLegs: Legs = {};
    const extraLegs: Legs = {};
    const [kpi, extra] = await Promise.all([
      loadKpiSummary(tenantId, filter, monthPrefix, kpiLegs),
      loadExtraSummary(filter, extraLegs),
    ]);
    Object.assign(legs, kpiLegs, extraLegs);
    payload = { ...kpi, ...extra };
  }

  const totalMs = Date.now() - started;
  console.log(`[timing] GET /dashboard/summary scope=${scope} DB ${formatTimingLegs(legs)} total=${totalMs}ms`);
  sendSuccess(res, payload);
});
