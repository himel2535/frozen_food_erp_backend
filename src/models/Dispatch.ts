import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const dispatchSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    route: String,
    vehicle: String,
    driver: String,
    date: String,
    status: {
      type: String,
      enum: ['open', 'in-transit', 'completed', 'cancelled'],
      default: 'open',
    },
    total: { type: Number, default: 0 },
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

dispatchSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });

export type DispatchDocument = InferSchemaType<typeof dispatchSchema> & { _id: mongoose.Types.ObjectId };

export const Dispatch =
  mongoose.models.Dispatch ?? mongoose.model('Dispatch', dispatchSchema);
