import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const leadSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    name: { type: String, required: true, trim: true },
    company: String,
    phone: String,
    alternativePhone: String,
    email: String,
    interestedProduct: String,
    customerRequirement: String,
    source: String,
    campaign: String,
    adCreative: String,
    status: { type: String, default: 'new' },
    priority: { type: String, default: 'warm' },
    assignedRepId: String,
    assignedRepName: String,
    expectedValue: { type: Number, default: 0 },
    probability: { type: Number, default: 0 },
    nextFollowUpAt: String,
    nextActionType: String,
    location: String,
    notes: String,
    conversionStatus: { type: String, default: 'open' },
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

leadSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
leadSchema.index({ tenantId: 1, name: 'text', company: 'text', email: 'text' });
leadSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, assignedRepId: 1, status: 1 });

export type LeadDocument = InferSchemaType<typeof leadSchema> & { _id: mongoose.Types.ObjectId };

export const Lead = mongoose.models.Lead ?? mongoose.model('Lead', leadSchema);
