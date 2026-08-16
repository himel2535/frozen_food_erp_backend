import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { reserveNextProductSku } from '../utils/productSkuSequence.js';

export const getNextProductSku = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = String(req.query.tenantId ?? 'default');
  const sku = await reserveNextProductSku(tenantId);
  sendSuccess(res, { sku });
});
