import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, lineItemSchema, tenantField, timestampsConfig } from './shared.js';

const quotationSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    customer: String,
    customerId: String,
    customerName: String,
    date: String,
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected'],
      default: 'draft',
    },
    items: [lineItemSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

quotationSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });

export type QuotationDocument = InferSchemaType<typeof quotationSchema> & { _id: mongoose.Types.ObjectId };

export const Quotation =
  mongoose.models.Quotation ?? mongoose.model('Quotation', quotationSchema);
