import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const warehouseSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    name: { type: String, required: true, trim: true },
    location: String,
    capacity: { type: Number, default: 0 },
    type: { type: String, default: 'Main Warehouse' },
    manager: String,
    contact: String,
    status: { type: String, enum: ['Active', 'Inactive', 'active', 'inactive'], default: 'Active' },
    allowedProductTypes: String,
    storageRules: String,
    imageUrl: String,
    imagePublicId: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

warehouseSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
warehouseSchema.index({ tenantId: 1, createdAt: -1 });
warehouseSchema.index({ tenantId: 1, name: 1 });

export type WarehouseDocument = InferSchemaType<typeof warehouseSchema> & { _id: mongoose.Types.ObjectId };

export const Warehouse =
  mongoose.models.Warehouse ?? mongoose.model('Warehouse', warehouseSchema);
