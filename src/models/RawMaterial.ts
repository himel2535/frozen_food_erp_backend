import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const rawMaterialSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    name: { type: String, required: true, trim: true },
    category: String,
    unit: { type: String, default: 'pcs' },
    quantity: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    threshold: { type: Number, default: 0 },
    stockDurationDays: { type: Number, default: 0 },
    stockDurationStartedAt: { type: Date },
    warehouseId: String,
    location: String,
    supplierId: String,
    supplierPrice: { type: Number, default: 0 },
    notes: String,
    imageUrl: String,
    imagePublicId: String,
    status: { type: String, default: 'active' },
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

rawMaterialSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
rawMaterialSchema.index({ tenantId: 1, name: 'text', category: 'text' });

export type RawMaterialDocument = InferSchemaType<typeof rawMaterialSchema> & { _id: mongoose.Types.ObjectId };

export const RawMaterial =
  mongoose.models.RawMaterial ?? mongoose.model('RawMaterial', rawMaterialSchema);
