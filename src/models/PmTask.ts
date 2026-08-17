import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const activitySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    userId: { type: String, trim: true },
    userName: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const pmTaskSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    projectId: { type: String, required: true, trim: true, index: true },
    projectName: { type: String, default: '', trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    assignedTo: { type: String, required: true, trim: true, index: true },
    assignedToName: { type: String, default: '', trim: true },
    assignedToEmail: { type: String, default: '', trim: true, lowercase: true },
    startDate: { type: String, trim: true, default: '' },
    deadline: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'completed'],
      default: 'todo',
    },
    attachmentUrl: String,
    attachmentPublicId: String,
    attachmentName: String,
    activity: { type: [activitySchema], default: [] },
    deadlineTomorrowNotifiedOn: { type: String, trim: true, default: '' },
    overdueNotifiedAt: Date,
  },
  timestampsConfig,
);

pmTaskSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
pmTaskSchema.index({ tenantId: 1, projectId: 1 });
pmTaskSchema.index({ tenantId: 1, assignedTo: 1 });
pmTaskSchema.index({ tenantId: 1, status: 1 });
pmTaskSchema.index({ tenantId: 1, deadline: 1 });
pmTaskSchema.index({ tenantId: 1, assignedTo: 1, status: 1, deadline: 1 });

pmTaskSchema.pre('save', async function () {
  const doc = this as mongoose.HydratedDocument<{
    assignedTo?: string;
    assignedToName?: string;
    assignedToEmail?: string;
    projectId?: string;
    projectName?: string;
    activity?: Array<{ at: Date; userId: string; userName: string; message: string }>;
  }>;
  if (doc.assignedTo) {
    const { Employee } = await import('./Employee.js');
    const employee = await Employee.findById(doc.assignedTo).select('name email').lean() as {
      name?: string;
      email?: string;
    } | null;
    if (employee) {
      doc.assignedToName = String(employee.name ?? '');
      doc.assignedToEmail = String(employee.email ?? '').trim().toLowerCase();
    }
  }
  if (doc.projectId) {
    const { PmProject } = await import('./PmProject.js');
    const project = await PmProject.findById(doc.projectId).select('name').lean() as { name?: string } | null;
    if (project) doc.projectName = String(project.name ?? '');
  }
  if (doc.isNew && (!doc.activity || doc.activity.length === 0)) {
    doc.activity = [{ at: new Date(), userId: '', userName: '', message: 'Task created' }];
  }
});

export type PmTaskDocument = InferSchemaType<typeof pmTaskSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PmTask =
  mongoose.models.PmTask ?? mongoose.model('PmTask', pmTaskSchema, 'pmtasks');
