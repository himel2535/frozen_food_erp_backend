import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const complaintSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    ticketNo: String,
    customerId: String,
    customerName: String,
    customerPhone: String,
    subject: { type: String, required: true, trim: true },
    description: String,
    category: String,
    priority: { type: String, default: 'medium' },
    status: { type: String, default: 'open' },
    sku: String,
    slaDueAt: String,
    evidenceImageUrl: String,
    evidenceImagePublicId: String,
    resolutionNotes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

complaintSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
complaintSchema.index({ tenantId: 1, subject: 'text', customerName: 'text' });

export type ComplaintDocument = InferSchemaType<typeof complaintSchema> & { _id: mongoose.Types.ObjectId };

export const Complaint =
  mongoose.models.Complaint ?? mongoose.model('Complaint', complaintSchema);
