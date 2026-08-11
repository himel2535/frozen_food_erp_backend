import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const categorySchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    type: { type: String, default: 'Finished Goods' },
    status: { type: String, enum: ['Active', 'Inactive', 'active', 'inactive'], default: 'Active' },
    description: String,
    parentId: String,
    defaultTaxRate: { type: Number, default: 0 },
    defaultUnitType: String,
    stockPolicy: { type: String, default: 'FIFO' },
    imageUrl: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

categorySchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
categorySchema.index({ tenantId: 1, name: 1 });

export type CategoryDocument = InferSchemaType<typeof categorySchema> & { _id: mongoose.Types.ObjectId };

export const Category =
  mongoose.models.Category ?? mongoose.model('Category', categorySchema);
