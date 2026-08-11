import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const paymentSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    customer: String,
    customerId: String,
    customerName: String,
    date: String,
    amount: { type: Number, default: 0 },
    method: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    invoiceId: String,
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

paymentSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });

export type PaymentDocument = InferSchemaType<typeof paymentSchema> & { _id: mongoose.Types.ObjectId };

export const Payment =
  mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema);
