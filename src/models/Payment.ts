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

export async function syncInvoicePayments(invoiceId: string | undefined | null, tenantId: string) {
  if (!invoiceId) return;
  try {
    const Invoice = mongoose.models.Invoice || mongoose.model('Invoice');
    const Payment = mongoose.models.Payment || mongoose.model('Payment');

    const aggregateResult = await Payment.aggregate([
      { $match: { tenantId, invoiceId, status: { $in: ['completed', 'received', 'Completed', 'Received'] } } },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } }
    ]);

    const totalPaid = aggregateResult[0]?.totalPaid ?? 0;
    const invoice = await Invoice.findOne({ legacyId: invoiceId, tenantId });
    if (!invoice) return;

    const totalAmount = Number(invoice.amount ?? 0);
    const due = Math.max(0, totalAmount - totalPaid);

    let status = invoice.status;
    if (due <= 0 && totalAmount > 0) {
      status = 'paid';
    } else if (totalPaid > 0 && totalPaid < totalAmount) {
      status = 'pending';
    }

    await Invoice.findOneAndUpdate(
      { _id: invoice._id },
      { $set: { paid: totalPaid, due, status } },
      { new: true }
    );
  } catch (err) {
    console.error(`[Mongoose Hook] Failed to sync payments for invoice ${invoiceId}:`, err);
  }
}

paymentSchema.post('save', async function (doc: any) {
  if (doc.invoiceId) {
    await syncInvoicePayments(doc.invoiceId, doc.tenantId);
  }
});

paymentSchema.post('findOneAndUpdate', async function (doc: any) {
  if (doc && doc.invoiceId) {
    await syncInvoicePayments(doc.invoiceId, doc.tenantId);
  }
});

paymentSchema.post('findOneAndDelete', async function (doc: any) {
  if (doc && doc.invoiceId) {
    await syncInvoicePayments(doc.invoiceId, doc.tenantId);
  }
});

export type PaymentDocument = InferSchemaType<typeof paymentSchema> & { _id: mongoose.Types.ObjectId };

export const Payment =
  mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema);
