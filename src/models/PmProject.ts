import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const pmProjectSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    managerId: { type: String, required: true, trim: true, index: true },
    managerName: { type: String, default: '', trim: true },
    startDate: { type: String, required: true, trim: true },
    deadline: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['planning', 'active', 'completed', 'on-hold'],
      default: 'planning',
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    taskCount: { type: Number, default: 0, min: 0 },
    completedTaskCount: { type: Number, default: 0, min: 0 },
  },
  timestampsConfig,
);

pmProjectSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
pmProjectSchema.index({ tenantId: 1, status: 1 });
pmProjectSchema.index({ tenantId: 1, managerId: 1 });
pmProjectSchema.index({ tenantId: 1, deadline: 1 });
pmProjectSchema.index({ tenantId: 1, createdAt: -1 });

pmProjectSchema.pre('save', async function () {
  const doc = this as mongoose.HydratedDocument<{ managerId?: string; managerName?: string }>;
  if (!doc.managerId || doc.managerName) return;
  const { Employee } = await import('./Employee.js');
  const employee = await Employee.findById(doc.managerId).select('name').lean() as { name?: string } | null;
  if (employee) doc.managerName = String(employee.name ?? '');
});

export type PmProjectDocument = InferSchemaType<typeof pmProjectSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PmProject =
  mongoose.models.PmProject ?? mongoose.model('PmProject', pmProjectSchema, 'pmprojects');
