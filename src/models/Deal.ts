import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const dealSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    title: { type: String, required: true, trim: true },
    company: String,
    contactPerson: String,
    phone: String,
    stage: { type: String, default: 'new-opportunity' },
    status: { type: String, default: 'open' },
    expectedValue: { type: Number, default: 0 },
    probability: { type: Number, default: 50 },
    expectedCloseDate: String,
    closeDate: String,
    leadSource: String,
    competitor: String,
    internalRemarks: String,
    assignedRepId: String,
    assignedRepName: String,
    linkedLeadId: String,
    linkedCustomerId: String,
    lastActivityAt: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

dealSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
dealSchema.index({ tenantId: 1, title: 'text', company: 'text' });
dealSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
dealSchema.index({ tenantId: 1, assignedRepId: 1, stage: 1 });

export type DealDocument = InferSchemaType<typeof dealSchema> & { _id: mongoose.Types.ObjectId };

export const Deal = mongoose.models.Deal ?? mongoose.model('Deal', dealSchema);
