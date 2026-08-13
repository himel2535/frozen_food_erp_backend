import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Unauthorized: Missing or invalid token format'));
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'fallback-secret-for-dev';

    const decoded = jwt.verify(token, secret) as { userId: string };
    
    const user = await User.findById(decoded.userId).lean();
    if (!user || user.status === 'disabled') {
      return next(new ApiError(401, 'Unauthorized: User not found or disabled'));
    }

    // Attach user to request
    (req as any).user = user;
    
    next();
  } catch (error) {
    next(new ApiError(401, 'Unauthorized: Invalid token'));
  }
}
