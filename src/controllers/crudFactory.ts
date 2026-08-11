import type { Request, Response } from 'express';
import type { Model, FilterQuery } from 'mongoose';
import { notFound, badRequest } from '../utils/ApiError.js';
import { sendSuccess, sendMessage } from '../utils/apiResponse.js';
import { asyncHandler, parsePagination, paginationMeta } from '../utils/asyncHandler.js';

type SearchFields = string[];

export function createCrudController<T extends Record<string, unknown>>(
  model: Model<T>,
  options: {
    resourceName: string;
    searchFields?: SearchFields;
    defaultSort?: Record<string, 1 | -1>;
  },
) {
  const { resourceName, searchFields = ['name'], defaultSort = { createdAt: -1 } } = options;

  const list = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip, search } = parsePagination(req.query);
    const tenantId = String(req.query.tenantId ?? 'default');
    const filter: FilterQuery<T> = { tenantId } as FilterQuery<T>;

    if (search && searchFields.length) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = searchFields.map((field) => ({ [field]: regex })) as FilterQuery<T>['$or'];
    }

    const status = req.query.status;
    if (status && status !== 'all') {
      (filter as Record<string, unknown>).status = status;
    }

    const [items, total] = await Promise.all([
      model.find(filter).sort(defaultSort).skip(skip).limit(limit).lean(),
      model.countDocuments(filter),
    ]);

    sendSuccess(res, items, paginationMeta(total, page, limit));
  });

  const getById = asyncHandler(async (req: Request, res: Response) => {
    const doc = await model.findById(req.params.id).lean();
    if (!doc) throw notFound(`${resourceName} not found`);
    sendSuccess(res, doc);
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const payload = { tenantId: 'default', ...req.body };
    const doc = await model.create(payload);
    sendSuccess(res, doc.toJSON(), undefined, 201);
  });

  const update = asyncHandler(async (req: Request, res: Response) => {
    const doc = await model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).lean();
    if (!doc) throw notFound(`${resourceName} not found`);
    sendSuccess(res, doc);
  });

  const remove = asyncHandler(async (req: Request, res: Response) => {
    const doc = await model.findByIdAndDelete(req.params.id);
    if (!doc) throw notFound(`${resourceName} not found`);
    sendMessage(res, `${resourceName} deleted`);
  });

  const bulkSeed = asyncHandler(async (req: Request, res: Response) => {
    const rows = req.body;
    if (!Array.isArray(rows)) throw badRequest('Body must be an array of records');
    const tenantId = String(req.query.tenantId ?? 'default');
    const prepared = rows.map((row) => ({ tenantId, ...row }));
    const inserted = await model.insertMany(prepared, { ordered: false }).catch((err) => {
      if (err?.insertedDocs) return err.insertedDocs;
      throw err;
    });
    sendSuccess(res, inserted, { count: inserted.length }, 201);
  });

  return { list, getById, create, update, remove, bulkSeed };
}
