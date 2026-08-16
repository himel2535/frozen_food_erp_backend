import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { tenantField, timestampsConfig } from './shared.js';

const sequenceSchema = new Schema(
  {
    tenantId: tenantField,
    key: { type: String, required: true, trim: true },
    value: { type: Number, default: 0 },
  },
  timestampsConfig,
);

sequenceSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export type SequenceDocument = InferSchemaType<typeof sequenceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Sequence =
  mongoose.models.Sequence ?? mongoose.model('Sequence', sequenceSchema);

export const PRODUCT_TOY_SKU_SEQUENCE_KEY = 'product-toy-sku';
