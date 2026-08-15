import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { tenantField, timestampsConfig } from './shared.js';

const notificationSchema = new Schema(
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

notificationSchema.index({ tenantId: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Notification =
  mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);
