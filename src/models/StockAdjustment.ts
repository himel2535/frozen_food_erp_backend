import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const stockAdjustmentSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    productId: { type: String, required: true },
    product: String,
    warehouseId: String,
    qty: { type: Number, default: 0 },
    unitValue: { type: Number, default: 0 },
    type: { type: String, enum: ['Increase', 'Decrease'], default: 'Increase' },
    date: String,
    reason: String,
    status: { type: String, enum: ['Pending', 'Completed', 'Cancelled'], default: 'Pending' },
    notes: String,
    approvedBy: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

stockAdjustmentSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
stockAdjustmentSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export type StockAdjustmentDocument = InferSchemaType<typeof stockAdjustmentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StockAdjustment =
  mongoose.models.StockAdjustment ?? mongoose.model('StockAdjustment', stockAdjustmentSchema);
