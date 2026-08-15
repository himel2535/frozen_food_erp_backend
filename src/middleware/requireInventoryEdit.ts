import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { isInventoryEditRequiredPath, userCanEditInventory } from '../config/granularPermissions.js';

export function requireInventoryEdit(req: Request, _res: Response, next: NextFunction) {
  if (!isInventoryEditRequiredPath(req.path, req.method)) {
    return next();
  }

  const user = (req as Request & { user?: { role?: string; allowedPermissions?: string[] } }).user;
  if (userCanEditInventory(user)) {
    return next();
  }

  return next(new ApiError(403, 'Forbidden: Inventory edit permission required'));
}
