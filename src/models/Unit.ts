import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const unitSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    symbol: String,
    status: { type: String, enum: ['Active', 'Inactive', 'active', 'inactive'], default: 'Active' },
    description: String,
    baseUnit: String,
    conversionFactor: { type: Number, default: 1 },
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

unitSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
unitSchema.index({ tenantId: 1, createdAt: -1 });
unitSchema.index({ tenantId: 1, code: 1 }, { unique: true, sparse: true });

export type UnitDocument = InferSchemaType<typeof unitSchema> & { _id: mongoose.Types.ObjectId };

export const Unit =
  mongoose.models.Unit ?? mongoose.model('Unit', unitSchema);
