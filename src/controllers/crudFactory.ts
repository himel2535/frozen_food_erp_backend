import type { Request, Response } from 'express';
import type { Model, FilterQuery } from 'mongoose';
import { notFound, badRequest } from '../utils/ApiError.js';
import { sendSuccess, sendMessage } from '../utils/apiResponse.js';
import { asyncHandler, parsePagination, paginationMeta } from '../utils/asyncHandler.js';
import { listFieldsFor } from '../config/listFieldProfiles.js';
import { clearResponseCache } from '../middleware/responseCache.js';
import { posCategoryMongoFilter } from '../utils/posCategoryFilter.js';
import { stampStockDurationOnCreate, stampStockDurationOnUpdate } from '../utils/stockDuration.js';
import {
  scheduleRemovedCloudinaryDeletes,
  scheduleReplacedCloudinaryDeletes,
} from '../utils/cloudinary.js';

type SearchFields = string[];

function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function isEmpty(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

export function serializeLeanDoc(doc: Record<string, unknown>) {
  const id = String(doc._id ?? doc.id ?? '');
  const { _id, __v, ...rest } = doc;
  return { ...rest, id };
}

/** Case-insensitive substring match across list search fields (`dd` matches `ddd`). */
export function buildListSearchFilter(search: string, searchFields: string[]): Record<string, unknown> | null {
  const q = search.trim();
  if (!q || !searchFields.length) return null;
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return { $or: searchFields.map((field) => ({ [field]: regex })) };
}

export function createCrudController<T extends Record<string, unknown>>(
  model: Model<T>,
  options: {
    resourceName: string;
    searchFields?: SearchFields;
    defaultSort?: Record<string, 1 | -1>;
    /** Always assign a fresh legacyId on create */
    legacyIdPrefix?: string;
    /** Other unique-ish fields to auto-fill on create when empty, e.g. { sku: 'SKU' } */
    autoFields?: Record<string, string>;
    /** Clear GET list cache for this path prefix after mutations (e.g. /api/v1/products). */
    listCachePrefix?: string;
    /** Optional post-create hook (e.g. realtime notifications). Must not throw to the client. */
    onCreated?: (doc: {
      _id: unknown;
      tenantId?: string;
      legacyId?: string;
      toJSON: () => Record<string, unknown>;
    }) => void | Promise<void>;
    /** Optional post-update hook. Must not throw to the client. */
    onUpdated?: (previous: Record<string, unknown>, next: Record<string, unknown>) => void | Promise<void>;
    /** When set, stamp stockDurationStartedAt on create and reset it when this qty field increases. */
    stockDurationQtyField?: string;
  },
) {
  const {
    resourceName,
    searchFields = ['name'],
    defaultSort = { createdAt: -1 },
    legacyIdPrefix,
    autoFields = {},
    listCachePrefix,
    onCreated,
    onUpdated,
    stockDurationQtyField,
  } = options;

  function clearCaches() {
    clearResponseCache('/api/v1/dashboard/summary');
    clearResponseCache('/api/v1/reports/');
    if (listCachePrefix) clearResponseCache(listCachePrefix);
  }

  function preparePayload(body: Record<string, unknown>, forCreate: boolean): Record<string, unknown> {
    const payload: Record<string, unknown> = { tenantId: 'default', ...body };

    for (const key of ['id', '_id', '_mongoId', 'legacyId', 'sku', 'employeeCode', 'ticketNo', 'receiptNo', 'code']) {
      if (key in payload && isEmpty(payload[key])) delete payload[key];
    }

    if (forCreate) {
      const clientLegacyId = payload.legacyId ?? body.id ?? body.legacyId;
      delete payload.id;
      delete payload._id;
      delete payload._mongoId;
      if (!isEmpty(clientLegacyId)) {
        payload.legacyId = String(clientLegacyId).trim();
      } else if (legacyIdPrefix) {
        payload.legacyId = generateUniqueId(legacyIdPrefix);
      } else {
        delete payload.legacyId;
      }
      for (const [field, prefix] of Object.entries(autoFields)) {
        if (isEmpty(payload[field])) {
          payload[field] = generateUniqueId(prefix);
        }
      }
      if (stockDurationQtyField) stampStockDurationOnCreate(payload);
    } else {
      const clientLegacyId = payload.legacyId ?? body.id ?? body.legacyId;
      if (!isEmpty(clientLegacyId)) {
        payload.legacyId = String(clientLegacyId).trim();
      } else {
        delete payload.legacyId;
      }
    }

    return payload;
  }

  async function createDocument(body: Record<string, unknown>) {
    try {
      return await model.create(preparePayload(body, true));
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code !== 11000) throw err;
      return await model.create(preparePayload(body, true));
    }
  }

  const list = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip, search } = parsePagination(req.query);
    const tenantId = String(req.query.tenantId ?? 'default');
    const filter: FilterQuery<T> = { tenantId } as FilterQuery<T>;

    const searchFilter = buildListSearchFilter(search, searchFields);
    if (searchFilter) {
      Object.assign(filter, searchFilter);
    }

    const status = req.query.status;
    if (status && status !== 'all') {
      (filter as Record<string, unknown>).status = status;
    }

    for (const key of ['category', 'section', 'department', 'period', 'productType', 'type'] as const) {
      const val = req.query[key];
      if (val && val !== 'all') {
        (filter as Record<string, unknown>)[key] = String(val);
      }
    }

    const posCategory = req.query.posCategory;
    if (posCategory && posCategory !== 'all') {
      const posFilter = posCategoryMongoFilter(String(posCategory));
      if (posFilter) {
        const existing = filter as Record<string, unknown>;
        existing.$and = [...(Array.isArray(existing.$and) ? existing.$and : []), posFilter];
      }
    }

    const listProjection = listFieldsFor(resourceName);
    let query = model.find(filter).sort(defaultSort).skip(skip).limit(limit);
    if (listProjection) {
      query = query.select(listProjection);
    }

    const [items, total] = await Promise.all([
      query.lean(),
      model.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      items.map((doc) => serializeLeanDoc(doc as Record<string, unknown>)),
      paginationMeta(total, page, limit),
    );
  });

  const getById = asyncHandler(async (req: Request, res: Response) => {
    const doc = await model.findById(req.params.id).lean();
    if (!doc) throw notFound(`${resourceName} not found`);
    sendSuccess(res, serializeLeanDoc(doc as Record<string, unknown>));
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const doc = await createDocument(req.body as Record<string, unknown>);
    clearCaches();
    if (onCreated) {
      try {
        await onCreated(doc);
      } catch (err) {
        console.error(`[${resourceName}] onCreated failed`, err);
      }
    }
    sendSuccess(res, doc.toJSON(), undefined, 201);
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
    const payload = preparePayload(req.body as Record<string, unknown>, false);
    const previous = await model.findById(req.params.id).lean();
    if (!previous) throw notFound(`${resourceName} not found`);
    if (stockDurationQtyField) {
      stampStockDurationOnUpdate(previous as Record<string, unknown>, payload, stockDurationQtyField);
    }
    const doc = await model.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) throw notFound(`${resourceName} not found`);
    clearCaches();
    scheduleReplacedCloudinaryDeletes(
      previous as Record<string, unknown>,
      doc as Record<string, unknown>,
    );
    if (onUpdated) {
      try {
        await onUpdated(previous as Record<string, unknown>, doc as Record<string, unknown>);
      } catch (err) {
        console.error(`[${resourceName}] onUpdated failed`, err);
      }
    }
    sendSuccess(res, doc);
  });

  const remove = asyncHandler(async (req: Request, res: Response) => {
    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) throw notFound(`${resourceName} not found`);
    clearCaches();
    scheduleRemovedCloudinaryDeletes(doc.toObject() as Record<string, unknown>);
    sendMessage(res, `${resourceName} deleted`);
  });

  const bulkSeed = asyncHandler(async (req: Request, res: Response) => {
    const rows = req.body;
    if (!Array.isArray(rows)) throw badRequest('Body must be an array of records');
    const prepared = rows.map((row) => preparePayload(row as Record<string, unknown>, true));
    const inserted = await model.insertMany(prepared, { ordered: false }).catch((err) => {
      if (err?.insertedDocs) return err.insertedDocs;
      throw err;
    });
    clearCaches();
    sendSuccess(res, inserted, { count: inserted.length }, 201);
  });

  return { list, getById, create, update, remove, bulkSeed };
}
