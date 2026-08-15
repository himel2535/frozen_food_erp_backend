import { InboxNotification } from '../models/InboxNotification.js';
import { emitToCompany, emitToUser } from '../realtime/emit.js';
import { NOTIFICATION_NEW_EVENT } from '../realtime/socket.js';

export type NotificationEventPayload = {
  id: string;
  type: string;
  message: string;
  refId?: string;
  createdAt: string;
};

export async function createAndEmitNotification(input: {
  tenantId?: string;
  userId?: string;
  type: string;
  message: string;
  refId?: string;
}): Promise<NotificationEventPayload> {
  const tenantId = input.tenantId?.trim() || 'default';
  const doc = await InboxNotification.create({
    tenantId,
    userId: input.userId?.trim() || undefined,
    type: input.type,
    message: input.message,
    refId: input.refId,
    read: false,
  });

  const createdAt =
    doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString();

  const payload: NotificationEventPayload = {
    id: String(doc._id),
    type: doc.type,
    message: doc.message,
    refId: doc.refId || undefined,
    createdAt,
  };

  console.log('[notify] emit', NOTIFICATION_NEW_EVENT, payload.id, payload.message);

  if (input.userId) {
    emitToUser(input.userId, NOTIFICATION_NEW_EVENT, payload);
  } else {
    emitToCompany(tenantId, NOTIFICATION_NEW_EVENT, payload);
  }

  return payload;
}
