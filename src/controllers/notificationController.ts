import type { Request, Response } from 'express';
import { InboxNotification } from '../models/InboxNotification.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function serializeNotification(doc: Record<string, unknown>) {
  const id = String(doc._id ?? doc.id ?? '');
  const createdAt = doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? '');
  return {
    id,
    type: String(doc.type ?? ''),
    message: String(doc.message ?? ''),
    refId: doc.refId ? String(doc.refId) : undefined,
    read: Boolean(doc.read),
    createdAt,
    userId: doc.userId ? String(doc.userId) : undefined,
  };
}

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as Request & { user?: { _id?: unknown; tenantId?: string } }).user;
  const userId = String(user?._id ?? '');
  const tenantId = String(user?.tenantId ?? 'default');

  const items = await InboxNotification.find({
    tenantId,
    $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }, { userId }],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  sendSuccess(
    res,
    items.map((doc) => serializeNotification(doc as Record<string, unknown>)),
  );
});
