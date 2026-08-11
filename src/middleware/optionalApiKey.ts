import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** Optional API key — skip when API_KEY env is empty (dev-friendly). */
export function optionalApiKey(req: Request, _res: Response, next: NextFunction) {
  if (!env.apiKey) return next();

  const header = req.header('x-api-key') ?? req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (header !== env.apiKey) {
    return next(new ApiError(401, 'Invalid or missing API key'));
  }
  return next();
}
