import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, lineItemSchema, tenantField, timestampsConfig } from './shared.js';

const posTransactionSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    receiptNo: String,
    customerId: String,
    customerName: String,
    date: String,
    items: [lineItemSchema],
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMethod: String,
    status: { type: String, default: 'completed' },
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

posTransactionSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });

export type PosTransactionDocument = InferSchemaType<typeof posTransactionSchema> & { _id: mongoose.Types.ObjectId };

export const PosTransaction =
  mongoose.models.PosTransaction ?? mongoose.model('PosTransaction', posTransactionSchema);
