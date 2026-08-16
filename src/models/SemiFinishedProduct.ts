import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const semiFinishedSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    name: { type: String, required: true, trim: true },
    category: String,
    unit: { type: String, default: 'pcs' },
    quantity: { type: Number, default: 0 },
    avgCost: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    warehouseId: String,
    location: String,
    recipeId: String,
    notes: String,
    imageUrl: String,
    imagePublicId: String,
    status: { type: String, default: 'active' },
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

semiFinishedSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
semiFinishedSchema.index({ tenantId: 1, name: 'text', category: 'text' });

export type SemiFinishedProductDocument = InferSchemaType<typeof semiFinishedSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SemiFinishedProduct =
  mongoose.models.SemiFinishedProduct ?? mongoose.model('SemiFinishedProduct', semiFinishedSchema);
