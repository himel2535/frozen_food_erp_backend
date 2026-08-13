import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.token;
    
    if (!token) {
      const authHeader = req.header('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return next(new ApiError(401, 'Unauthorized: Missing or invalid token'));
    }

    const secret = process.env.JWT_SECRET || 'fallback-secret-for-dev';

    const decoded = jwt.verify(token, secret) as { userId: string };
    
    const user = await User.findById(decoded.userId).lean();
    if (!user || (user as any).status === 'disabled') {
      return next(new ApiError(401, 'Unauthorized: User not found or disabled'));
    }

    // Attach user to request
    (req as any).user = user;
    
    next();
  } catch (error) {
    next(new ApiError(401, 'Unauthorized: Invalid token'));
  }
}
