import mongoose, { Schema, type Model } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

/** Flexible Mongoose model — accepts any form fields (strict: false). */
export function createFlexibleModel(modelName: string): Model<Record<string, unknown>> {
  const schema = new Schema(
    {
      tenantId: tenantField,
      legacyId: legacyIdField,
      status: { type: String, default: 'active' },
      name: String,
    },
    { strict: false, ...timestampsConfig },
  );
  schema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
  return (mongoose.models[modelName] as Model<Record<string, unknown>> | undefined)
    ?? mongoose.model<Record<string, unknown>>(modelName, schema);
}
