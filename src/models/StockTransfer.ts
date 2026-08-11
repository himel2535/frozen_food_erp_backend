import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const stockTransferSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    productId: { type: String, required: true },
    product: String,
    fromWarehouseId: String,
    toWarehouseId: String,
    qty: { type: Number, default: 0 },
    date: String,
    status: { type: String, enum: ['Pending', 'Completed', 'Cancelled'], default: 'Pending' },
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

stockTransferSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
stockTransferSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export type StockTransferDocument = InferSchemaType<typeof stockTransferSchema> & { _id: mongoose.Types.ObjectId };

export const StockTransfer =
  mongoose.models.StockTransfer ?? mongoose.model('StockTransfer', stockTransferSchema);
