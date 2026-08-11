import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, lineItemSchema, tenantField, timestampsConfig } from './shared.js';

const deliverySchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    customer: String,
    customerId: String,
    customerName: String,
    orderId: String,
    date: String,
    status: {
      type: String,
      enum: ['draft', 'dispatched', 'delivered', 'cancelled'],
      default: 'draft',
    },
    items: [lineItemSchema],
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    deliveryAddress: String,
    contactPerson: String,
    warehouseId: String,
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

deliverySchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });

export type DeliveryDocument = InferSchemaType<typeof deliverySchema> & { _id: mongoose.Types.ObjectId };

export const Delivery =
  mongoose.models.Delivery ?? mongoose.model('Delivery', deliverySchema);
