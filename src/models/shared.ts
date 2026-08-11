import { Schema } from 'mongoose';

/** Matches frontend legacy string ids e.g. CUST-001, SKU-PLST-01 */
export const legacyIdField = {
  type: String,
  trim: true,
  index: true,
};

export const timestampsConfig = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(_doc: unknown, ret: Record<string, unknown>) {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};

export const tenantField = {
  type: String,
  default: 'default',
  index: true,
};

export const lineItemSchema = new Schema(
  {
    description: String,
    name: String,
    sku: String,
    qty: { type: Number, default: 1 },
    rate: { type: Number, default: 0 },
    price: Number,
    total: Number,
    taxRate: Number,
  },
  { _id: false },
);
