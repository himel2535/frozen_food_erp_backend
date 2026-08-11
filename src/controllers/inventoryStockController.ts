import type { Request, Response } from 'express';
import { Product } from '../models/Product.js';
import { StockIn } from '../models/StockIn.js';
import { StockOut } from '../models/StockOut.js';
import { StockTransfer } from '../models/StockTransfer.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { notFound, badRequest } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

type WarehouseStock = Record<string, number>;

function syncStock(ws: WarehouseStock) {
  const stock = Object.values(ws).reduce((s, v) => s + Number(v || 0), 0);
  return { warehouseStock: ws, stock };
}

async function findProduct(productId: string) {
  const byId = await Product.findById(productId);
  if (byId) return byId;
  return Product.findOne({ legacyId: productId });
}

async function applyProductDelta(productId: string, warehouseId: string, delta: number) {
  const product = await findProduct(productId);
  if (!product) throw notFound('Product not found');

  const ws: WarehouseStock = { ...(product.warehouseStock as WarehouseStock ?? {}) };
  if (warehouseId) {
    ws[warehouseId] = Math.max(0, Number(ws[warehouseId] ?? 0) + delta);
  } else {
    product.stock = Math.max(0, Number(product.stock ?? 0) + delta);
    await product.save();
    return product;
  }

  const synced = syncStock(ws);
  product.warehouseStock = synced.warehouseStock;
  product.stock = synced.stock;
  await product.save();
  return product;
}

async function getAvailableStock(productId: string, warehouseId: string) {
  const product = await findProduct(productId);
  if (!product) throw notFound('Product not found');
  const ws = (product.warehouseStock as WarehouseStock) ?? {};
  const m = meta(product);
  const reserved = Number(m.reserved ?? 0);
  const whQty = warehouseId ? Number(ws[warehouseId] ?? 0) : Number(product.stock ?? 0);
  return Math.max(0, whQty - reserved);
}

function meta(doc: { meta?: unknown }) {
  return (doc.meta ?? {}) as Record<string, unknown>;
}

export const approveStockIn = asyncHandler(async (req: Request, res: Response) => {
  const doc = await StockIn.findById(req.params.id);
  if (!doc) throw notFound('Stock in record not found');
  if (doc.status === 'Approved') {
    sendSuccess(res, doc.toJSON());
    return;
  }
  if (doc.status === 'Cancelled') throw badRequest('Cannot approve cancelled record');

  await applyProductDelta(String(doc.productId), String(doc.warehouseId ?? ''), Number(doc.qty ?? 0));
  doc.status = 'Approved';
  doc.approvedBy = String(req.body?.approvedBy ?? 'System');
  await doc.save();
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

  await applyProductDelta(String(doc.productId), String(doc.warehouseId ?? ''), -qty);
  doc.status = 'Completed';
  await doc.save();
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
  const product = await findProduct(String(doc.productId));
  if (!product) throw notFound('Product not found');

  const ws = (product.warehouseStock as WarehouseStock) ?? {};
  if (Number(ws[from] ?? 0) < qty) {
    throw badRequest('Insufficient stock at source warehouse');
  }

  await applyProductDelta(String(doc.productId), from, -qty);
  await applyProductDelta(String(doc.productId), to, qty);
  doc.status = 'Completed';
  await doc.save();
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
  await applyProductDelta(String(doc.productId), String(doc.warehouseId ?? ''), delta);
  doc.status = 'Completed';
  doc.approvedBy = String(req.body?.approvedBy ?? 'System');
  await doc.save();
  sendSuccess(res, doc.toJSON());
});
