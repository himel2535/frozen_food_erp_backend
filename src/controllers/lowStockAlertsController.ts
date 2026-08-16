import type { Request, Response } from 'express';
import {
  Product,
  RawMaterial,
  SemiFinishedProduct,
  FinishedGood,
} from '../models/index.js';
import { asyncHandler, parsePagination, paginationMeta } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { serializeLeanDoc, buildListSearchFilter } from '../controllers/crudFactory.js';
import {
  productLowStockFilter,
  rawMaterialLowStockFilter,
  quantityMinStockLowStockFilter,
  resolveProductLowStockMin,
} from '../utils/lowStockMongo.js';
import { stockDurationMetrics, compareByRemainingRatio } from '../utils/stockDuration.js';

const LIST_CAP = 500;
const LIST_PROJECTION =
  'legacyId name sku category imageUrl stock quantity minStock reorderLevel threshold unit uom stockDurationDays stockDurationStartedAt createdAt';

export type LowStockItemType = 'product' | 'rawMaterial' | 'semiFinished' | 'finishedGood';

const ITEM_HREF: Record<LowStockItemType, string> = {
  product: '/inventory/products',
  rawMaterial: '/inventory/raw-materials',
  semiFinished: '/inventory/semi-finished-products',
  finishedGood: '/inventory/finished-goods',
};

const ITEM_LABEL: Record<LowStockItemType, string> = {
  product: 'Product',
  rawMaterial: 'Raw Material',
  semiFinished: 'Semi-Finished',
  finishedGood: 'Finished Good',
};

type LeanModel = {
  find: (filter: Record<string, unknown>) => {
    select: (projection: string) => {
      limit: (n: number) => { lean: () => Promise<unknown[]> };
    };
  };
};

type Source = {
  type: LowStockItemType;
  model: LeanModel;
  filter: Record<string, unknown>;
  qtyField: 'stock' | 'quantity';
  minField: 'minStock' | 'threshold' | 'reorderLevel';
};

const SOURCES: Source[] = [
  { type: 'product', model: Product as unknown as LeanModel, filter: productLowStockFilter(), qtyField: 'stock', minField: 'minStock' },
  { type: 'rawMaterial', model: RawMaterial as unknown as LeanModel, filter: rawMaterialLowStockFilter(), qtyField: 'quantity', minField: 'threshold' },
  { type: 'semiFinished', model: SemiFinishedProduct as unknown as LeanModel, filter: quantityMinStockLowStockFilter(), qtyField: 'quantity', minField: 'minStock' },
  { type: 'finishedGood', model: FinishedGood as unknown as LeanModel, filter: quantityMinStockLowStockFilter(), qtyField: 'quantity', minField: 'minStock' },
];

function mapAlertRow(doc: Record<string, unknown>, source: Source) {
  const serialized = serializeLeanDoc(doc) as Record<string, unknown> & { id: string };
  const qty = Number(serialized[source.qtyField] ?? 0);
  const min = source.type === 'product'
    ? resolveProductLowStockMin(serialized)
    : Number(serialized[source.minField] ?? 0);
  const duration = stockDurationMetrics(serialized);
  return {
    id: serialized.id,
    legacyId: serialized.legacyId ?? '',
    name: String(serialized.name ?? ''),
    sku: String(serialized.sku ?? ''),
    category: String(serialized.category ?? ''),
    imageUrl: String(serialized.imageUrl ?? ''),
    unit: String(serialized.uom ?? serialized.unit ?? 'pcs'),
    qty,
    min,
    itemType: source.type,
    itemTypeLabel: ITEM_LABEL[source.type],
    href: ITEM_HREF[source.type],
    stockDurationDays: Number(serialized.stockDurationDays ?? 0),
    stockDurationStartedAt: serialized.stockDurationStartedAt ?? null,
    createdAt: serialized.createdAt ?? null,
    expectedDays: duration.expectedDays,
    elapsedDays: duration.elapsedDays,
    remainingDays: duration.remainingDays,
    remainingRatio: duration.remainingRatio,
    overdue: duration.overdue,
  };
}

function parseItemType(raw: unknown): LowStockItemType | 'all' {
  const value = String(raw ?? 'all').trim();
  if (value === 'product' || value === 'rawMaterial' || value === 'semiFinished' || value === 'finishedGood') {
    return value;
  }
  return 'all';
}

export const listLowStockAlerts = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search } = parsePagination(req.query);
  const tenantId = String(req.query.tenantId ?? 'default');
  const itemType = parseItemType(req.query.itemType);
  const searchFilter = buildListSearchFilter(search, ['name', 'sku', 'legacyId', 'category']);
  const sources = itemType === 'all' ? SOURCES : SOURCES.filter((s) => s.type === itemType);

  const batches = await Promise.all(
    sources.map(async (source) => {
      const filter: Record<string, unknown> = { tenantId, ...source.filter };
      if (searchFilter) Object.assign(filter, searchFilter);
      const docs = await source.model.find(filter).select(LIST_PROJECTION).limit(LIST_CAP).lean();
      return (docs as Record<string, unknown>[]).map((doc) => mapAlertRow(doc, source));
    }),
  );

  const rows = batches.flat().sort(compareByRemainingRatio);

  const counts = {
    total: rows.length,
    products: rows.filter((r) => r.itemType === 'product').length,
    rawMaterials: rows.filter((r) => r.itemType === 'rawMaterial').length,
    overdue: rows.filter((r) => r.overdue).length,
  };

  const start = (page - 1) * limit;
  sendSuccess(
    res,
    rows.slice(start, start + limit),
    { ...paginationMeta(rows.length, page, limit), counts },
  );
});
