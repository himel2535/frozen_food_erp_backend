import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { tenantField, timestampsConfig } from './shared.js';

const inboxNotificationSchema = new Schema(
  {
    tenantId: tenantField,
    userId: { type: String, trim: true, index: true },
    type: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    refId: { type: String, trim: true },
    read: { type: Boolean, default: false, index: true },
  },
  timestampsConfig,
);

inboxNotificationSchema.index({ tenantId: 1, createdAt: -1 });
inboxNotificationSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

export type InboxNotificationDocument = InferSchemaType<typeof inboxNotificationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const InboxNotification =
  mongoose.models.InboxNotification
  ?? mongoose.model('InboxNotification', inboxNotificationSchema);
