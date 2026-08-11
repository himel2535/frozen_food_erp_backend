import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const stockInSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    productId: { type: String, required: true },
    product: String,
    warehouseId: String,
    qty: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
    date: String,
    sourceType: { type: String, default: 'Purchase' },
    refDocId: String,
    supplier: String,
    status: { type: String, enum: ['Pending', 'Approved', 'Cancelled'], default: 'Pending' },
    batchNumber: String,
    expiryDate: String,
    notes: String,
    approvedBy: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

stockInSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
stockInSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export type StockInDocument = InferSchemaType<typeof stockInSchema> & { _id: mongoose.Types.ObjectId };

export const StockIn =
  mongoose.models.StockIn ?? mongoose.model('StockIn', stockInSchema);
