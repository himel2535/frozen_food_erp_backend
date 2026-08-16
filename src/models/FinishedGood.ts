import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const finishedGoodSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    name: { type: String, required: true, trim: true },
    category: String,
    unit: { type: String, default: 'pcs' },
    quantity: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    avgCost: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    warehouseId: String,
    location: String,
    notes: String,
    imageUrl: String,
    imagePublicId: String,
    status: { type: String, default: 'active' },
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

finishedGoodSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
finishedGoodSchema.index({ tenantId: 1, name: 'text', category: 'text' });

export type FinishedGoodDocument = InferSchemaType<typeof finishedGoodSchema> & { _id: mongoose.Types.ObjectId };

export const FinishedGood =
  mongoose.models.FinishedGood ?? mongoose.model('FinishedGood', finishedGoodSchema);
