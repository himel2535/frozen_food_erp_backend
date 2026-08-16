import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const productSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    sku: { type: String, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    category: String,
    productType: {
      type: String,
      enum: ['Raw Materials', 'Semi-Finished Goods', 'Finished Goods', 'Service', ''],
      default: '',
    },
    cost: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    wholesalePrice: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    stockDurationDays: { type: Number, default: 0 },
    stockDurationStartedAt: { type: Date },
    uom: String,
    defaultWarehouse: String,
    warehouseStock: Schema.Types.Mixed,
    imageUrl: String,
    description: String,
    status: { type: String, enum: ['active', 'inactive', 'discontinued'], default: 'active' },
    discontinued: { type: Boolean, default: false },
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

productSchema.index({ tenantId: 1, sku: 1 }, { unique: true, sparse: true });
productSchema.index({ tenantId: 1, name: 'text', sku: 'text', category: 'text' });

export type ProductDocument = InferSchemaType<typeof productSchema> & { _id: mongoose.Types.ObjectId };

export const Product =
  mongoose.models.Product ?? mongoose.model('Product', productSchema);
