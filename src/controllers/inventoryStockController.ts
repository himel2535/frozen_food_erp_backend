import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
import { Product } from '../models/Product.js';
import { RawMaterial } from '../models/RawMaterial.js';
import { SemiFinishedProduct } from '../models/SemiFinishedProduct.js';
import { FinishedGood } from '../models/FinishedGood.js';
import { StockIn } from '../models/StockIn.js';
import { StockOut } from '../models/StockOut.js';
import { StockTransfer } from '../models/StockTransfer.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { notFound, badRequest } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { clearResponseCache } from '../middleware/responseCache.js';

function clearInventoryCaches() {
  clearResponseCache('/api/v1/dashboard/summary');
  clearResponseCache('/api/v1/dashboard/top-products');
  clearResponseCache('/api/v1/dashboard/business-alerts');
  clearResponseCache('/api/v1/reports/');
  for (const prefix of [
    '/api/v1/products',
    '/api/v1/raw-materials',
    '/api/v1/semi-finished-products',
    '/api/v1/finished-goods',
    '/api/v1/stock-in',
    '/api/v1/stock-out',
    '/api/v1/stock-transfers',
    '/api/v1/stock-adjustments',
  ]) {
    clearResponseCache(prefix);
  }
}

type WarehouseStock = Record<string, number>;
type InventoryKind = 'product' | 'rawMaterial' | 'semiFinished' | 'finishedGood';

type InventoryDoc = Record<string, unknown> & { save: () => Promise<unknown> };

type InventoryRef = {
  kind: InventoryKind;
  doc: InventoryDoc;
};

function syncStock(ws: WarehouseStock) {
  const stock = Object.values(ws).reduce((s, v) => s + Number(v || 0), 0);
  return { warehouseStock: ws, stock };
}

function readMeta(doc: InventoryDoc) {
  return (doc.meta ?? {}) as Record<string, unknown>;
}

async function findByIdOrLegacyId(model: Model<unknown>, id: string) {
  const byId = await model.findById(id);
  if (byId) return byId;
  return model.findOne({ legacyId: id });
}

async function resolveInventoryItem(productId: string): Promise<InventoryRef | null> {
  const searches: Array<[InventoryKind, Model<unknown>]> = [
    ['rawMaterial', RawMaterial],
    ['semiFinished', SemiFinishedProduct],
    ['finishedGood', FinishedGood],
    ['product', Product],
  ];

  for (const [kind, model] of searches) {
    const doc = await findByIdOrLegacyId(model, productId);
    if (doc) {
      return { kind, doc: doc as unknown as InventoryDoc };
    }
  }
  return null;
}

function getQuantity(item: InventoryRef): number {
  const doc = item.doc;
  if (item.kind === 'product') return Number(doc.stock ?? 0);
  return Number(doc.quantity ?? 0);
}

function getAvailableFromItem(item: InventoryRef, warehouseId: string): number {
  const doc = item.doc;
  if (item.kind === 'product') {
    const ws = (doc.warehouseStock as WarehouseStock) ?? {};
    const reserved = Number(readMeta(doc).reserved ?? 0);
    const whQty = warehouseId ? Number(ws[warehouseId] ?? 0) : Number(doc.stock ?? 0);
    return Math.max(0, whQty - reserved);
  }

  if (warehouseId && doc.warehouseId && String(doc.warehouseId) !== warehouseId) {
    return 0;
  }
  const qty = Number(doc.quantity ?? 0);
  if (item.kind === 'finishedGood') {
    const reserved = Number(doc.reserved ?? 0);
    return Math.max(0, qty - reserved);
  }
  return Math.max(0, qty);
}

async function applyInventoryDelta(productId: string, warehouseId: string, delta: number) {
  const item = await resolveInventoryItem(productId);
  if (!item) throw notFound('Inventory item not found');

  const doc = item.doc;

  if (item.kind === 'product') {
    const ws: WarehouseStock = { ...(doc.warehouseStock as WarehouseStock ?? {}) };
    if (warehouseId) {
      ws[warehouseId] = Math.max(0, Number(ws[warehouseId] ?? 0) + delta);
      const synced = syncStock(ws);
      doc.warehouseStock = synced.warehouseStock;
      doc.stock = synced.stock;
    } else {
      doc.stock = Math.max(0, Number(doc.stock ?? 0) + delta);
    }
    await doc.save();
    return doc;
  }

  if (warehouseId && !doc.warehouseId) {
    doc.warehouseId = warehouseId;
  }
  doc.quantity = Math.max(0, getQuantity(item) + delta);
  await doc.save();
  return doc;
}

async function getAvailableStock(productId: string, warehouseId: string) {
  const item = await resolveInventoryItem(productId);
  if (!item) throw notFound('Inventory item not found');
  return getAvailableFromItem(item, warehouseId);
}

export const approveStockIn = asyncHandler(async (req: Request, res: Response) => {
  const doc = await StockIn.findById(req.params.id);
  if (!doc) throw notFound('Stock in record not found');
  if (doc.status === 'Approved') {
    sendSuccess(res, doc.toJSON());
    return;
  }
  if (doc.status === 'Cancelled') throw badRequest('Cannot approve cancelled record');

  await applyInventoryDelta(String(doc.productId), String(doc.warehouseId ?? ''), Number(doc.qty ?? 0));
  doc.status = 'Approved';
  doc.approvedBy = String(req.body?.approvedBy ?? 'System');
  await doc.save();
  clearInventoryCaches();
  sendSuccess(res, doc.toJSON());
});

export const completeStockOut = asyncHandler(async (req: Request, res: Response) => {
  const doc = await StockOut.findById(req.params.id);
  if (!doc) throw notFound('Stock out record not found');
  if (doc.status === 'Completed') {
    sendSuccess(res, doc.toJSON());
    return;
  }
  if (doc.status === 'Cancelled') throw badRequest('Cannot complete cancelled record');

  const available = await getAvailableStock(String(doc.productId), String(doc.warehouseId ?? ''));
  const qty = Number(doc.qty ?? 0);
  if (qty > available) throw badRequest(`Insufficient stock (available: ${available})`);

  await applyInventoryDelta(String(doc.productId), String(doc.warehouseId ?? ''), -qty);
  doc.status = 'Completed';
  await doc.save();
  clearInventoryCaches();
  sendSuccess(res, doc.toJSON());
});

export const completeStockTransfer = asyncHandler(async (req: Request, res: Response) => {
  const doc = await StockTransfer.findById(req.params.id);
  if (!doc) throw notFound('Transfer record not found');
  if (doc.status === 'Completed') {
    sendSuccess(res, doc.toJSON());
    return;
  }
  if (doc.status === 'Cancelled') throw badRequest('Cannot complete cancelled transfer');

  const from = String(doc.fromWarehouseId ?? '');
  const to = String(doc.toWarehouseId ?? '');
  const qty = Number(doc.qty ?? 0);
  const item = await resolveInventoryItem(String(doc.productId));
  if (!item) throw notFound('Inventory item not found');

  if (item.kind === 'product') {
    const ws = (item.doc.warehouseStock as WarehouseStock) ?? {};
    if (Number(ws[from] ?? 0) < qty) {
      throw badRequest('Insufficient stock at source warehouse');
    }
    await applyInventoryDelta(String(doc.productId), from, -qty);
    await applyInventoryDelta(String(doc.productId), to, qty);
  } else {
    const available = getAvailableFromItem(item, from);
    if (qty > available) throw badRequest('Insufficient stock at source warehouse');
    const totalQty = getQuantity(item);
    if (qty < totalQty) {
      throw badRequest('Partial warehouse transfer is only supported for catalog products');
    }
    if (to) item.doc.warehouseId = to;
    await item.doc.save();
  }

  doc.status = 'Completed';
  await doc.save();
  clearInventoryCaches();
  sendSuccess(res, doc.toJSON());
});

export const approveStockAdjustment = asyncHandler(async (req: Request, res: Response) => {
  const doc = await StockAdjustment.findById(req.params.id);
  if (!doc) throw notFound('Adjustment record not found');
  if (doc.status === 'Completed') {
    sendSuccess(res, doc.toJSON());
    return;
  }
  if (doc.status === 'Cancelled') throw badRequest('Cannot approve cancelled adjustment');

  const qty = Number(doc.qty ?? 0);
  const delta = String(doc.type) === 'Decrease' ? -qty : qty;
  await applyInventoryDelta(String(doc.productId), String(doc.warehouseId ?? ''), delta);
  doc.status = 'Completed';
  doc.approvedBy = String(req.body?.approvedBy ?? 'System');
  await doc.save();
  clearInventoryCaches();
  sendSuccess(res, doc.toJSON());
});
