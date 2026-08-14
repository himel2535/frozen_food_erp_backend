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

export async function syncCustomerDue(customerId: string | undefined | null, tenantId: string) {
  if (!customerId) return;
  try {
    const Customer = mongoose.models.Customer || mongoose.model('Customer');
    const Invoice = mongoose.models.Invoice || mongoose.model('Invoice');

    const aggregateResult = await Invoice.aggregate([
      { $match: { tenantId, customerId, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalDue: { $sum: '$due' } } }
    ]);

    const totalDue = aggregateResult[0]?.totalDue ?? 0;

    const query: Record<string, unknown> = { tenantId };
    if (mongoose.isValidObjectId(customerId)) {
      query._id = customerId;
    } else {
      query.legacyId = customerId;
    }

    await Customer.updateOne(query, { $set: { totalDue } });
  } catch (err) {
    console.error(`[Mongoose Hook] Failed to sync customer ${customerId} due:`, err);
  }
}

invoiceSchema.post('save', async function (doc: any) {
  if (doc.customerId) {
    await syncCustomerDue(doc.customerId, doc.tenantId);
  }
});

invoiceSchema.post('findOneAndUpdate', async function (doc: any) {
  if (doc && doc.customerId) {
    await syncCustomerDue(doc.customerId, doc.tenantId);
  }
});

invoiceSchema.post('findOneAndDelete', async function (doc: any) {
  if (doc && doc.customerId) {
    await syncCustomerDue(doc.customerId, doc.tenantId);
  }
});

export type InvoiceDocument = InferSchemaType<typeof invoiceSchema> & { _id: mongoose.Types.ObjectId };

export const Invoice =
  mongoose.models.Invoice ?? mongoose.model('Invoice', invoiceSchema);
