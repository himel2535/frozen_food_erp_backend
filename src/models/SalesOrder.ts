import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, lineItemSchema, tenantField, timestampsConfig } from './shared.js';

const salesOrderSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    customer: String,
    customerId: String,
    customerName: String,
    date: String,
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'processing', 'fulfilled', 'cancelled'],
      default: 'draft',
    },
    items: [lineItemSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: String,
    attachmentUrl: String,
    attachmentPublicId: String,
    attachmentName: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

salesOrderSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
salesOrderSchema.index({ tenantId: 1, date: -1 });
salesOrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
salesOrderSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });

export type SalesOrderDocument = InferSchemaType<typeof salesOrderSchema> & { _id: mongoose.Types.ObjectId };

export const SalesOrder =
  mongoose.models.SalesOrder ?? mongoose.model('SalesOrder', salesOrderSchema);
