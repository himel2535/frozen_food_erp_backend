import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { authenticateAccessToken, extractAccessTokenFromRequest } from './authToken.js';
import { timePerfLeg } from './perfTrace.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractAccessTokenFromRequest(req);
    if (!token) {
      return next(new ApiError(401, 'Unauthorized: Missing or invalid token'));
    }

    (req as Request & { user?: unknown }).user = await timePerfLeg(req, 'auth', () =>
      authenticateAccessToken(token),
    );
    next();
  } catch {
    next(new ApiError(401, 'Unauthorized: Invalid token'));
  }
}
