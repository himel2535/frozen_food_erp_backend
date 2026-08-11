import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, lineItemSchema, tenantField, timestampsConfig } from './shared.js';

const returnSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    customer: String,
    customerId: String,
    customerName: String,
    invoiceId: String,
    date: String,
    status: {
      type: String,
      enum: ['draft', 'approved', 'processed', 'rejected'],
      default: 'draft',
    },
    items: [lineItemSchema],
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

returnSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });

export type ReturnDocument = InferSchemaType<typeof returnSchema> & { _id: mongoose.Types.ObjectId };

export const SalesReturn =
  mongoose.models.SalesReturn ?? mongoose.model('SalesReturn', returnSchema);
