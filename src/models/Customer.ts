import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const customerSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    name: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'overdue', 'credit-hold'],
      default: 'active',
    },
    category: String,
    companyType: String,
    pricingTier: String,
    creditLimit: { type: Number, default: 0 },
    paymentTerms: String,
    ownerId: String,
    ownerName: String,
    billingAddress: String,
    billingCity: String,
    shippingAddress: String,
    shippingCity: String,
    imageUrl: String,
    imagePublicId: String,
    notes: String,
    tags: [String],
    totalSales: { type: Number, default: 0 },
    totalDue: { type: Number, default: 0 },
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

customerSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
customerSchema.index({ tenantId: 1, name: 1 });
customerSchema.index({ tenantId: 1, company: 'text', name: 'text', email: 'text' });
customerSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
customerSchema.index({ tenantId: 1, totalDue: -1 });

export type CustomerDocument = InferSchemaType<typeof customerSchema> & { _id: mongoose.Types.ObjectId };

export const Customer =
  mongoose.models.Customer ?? mongoose.model('Customer', customerSchema);
