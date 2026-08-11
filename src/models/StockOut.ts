import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const stockOutSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    productId: { type: String, required: true },
    product: String,
    warehouseId: String,
    qty: { type: Number, default: 0 },
    unitValue: { type: Number, default: 0 },
    date: String,
    sourceType: { type: String, default: 'Sales' },
    refDocId: String,
    reasonCode: String,
    status: { type: String, enum: ['Pending', 'Completed', 'Cancelled'], default: 'Pending' },
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

stockOutSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
stockOutSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export type StockOutDocument = InferSchemaType<typeof stockOutSchema> & { _id: mongoose.Types.ObjectId };

export const StockOut =
  mongoose.models.StockOut ?? mongoose.model('StockOut', stockOutSchema);
