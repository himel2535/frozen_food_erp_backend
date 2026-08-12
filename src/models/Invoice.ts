import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, lineItemSchema, tenantField, timestampsConfig } from './shared.js';

const invoiceSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    customerId: String,
    customerName: String,
    issueDate: String,
    date: String,
    dueDate: String,
    status: {
      type: String,
      enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled'],
      default: 'pending',
    },
    items: [lineItemSchema],
    amount: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

invoiceSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ tenantId: 1, issueDate: -1, date: -1 });
invoiceSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ tenantId: 1, customerId: 1, issueDate: -1 });

export type InvoiceDocument = InferSchemaType<typeof invoiceSchema> & { _id: mongoose.Types.ObjectId };

export const Invoice =
  mongoose.models.Invoice ?? mongoose.model('Invoice', invoiceSchema);
