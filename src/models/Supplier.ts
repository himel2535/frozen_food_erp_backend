import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const supplierSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    code: String,
    name: { type: String, required: true, trim: true },
    contactName: String,
    phone: String,
    email: { type: String, trim: true, lowercase: true },
    category: String,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    address: String,
    city: String,
    country: String,
    paymentTerms: String,
    creditLimit: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    imageUrl: String,
    imagePublicId: String,
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

supplierSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
supplierSchema.index({ tenantId: 1, name: 'text', code: 'text' });

export type SupplierDocument = InferSchemaType<typeof supplierSchema> & { _id: mongoose.Types.ObjectId };

export const Supplier =
  mongoose.models.Supplier ?? mongoose.model('Supplier', supplierSchema);
