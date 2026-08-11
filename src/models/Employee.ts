import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { legacyIdField, tenantField, timestampsConfig } from './shared.js';

const employeeSchema = new Schema(
  {
    tenantId: tenantField,
    legacyId: legacyIdField,
    employeeCode: String,
    name: { type: String, required: true, trim: true },
    employeeType: { type: String, enum: ['Staff', 'Worker', 'Contract'], default: 'Staff' },
    department: String,
    designation: String,
    phone: String,
    email: { type: String, trim: true, lowercase: true },
    joiningDate: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'on-leave', 'terminated'],
      default: 'active',
    },
    salary: { type: Number, default: 0 },
    manager: String,
    address: String,
    city: String,
    imageUrl: String,
    notes: String,
    meta: Schema.Types.Mixed,
  },
  timestampsConfig,
);

employeeSchema.index({ tenantId: 1, legacyId: 1 }, { unique: true, sparse: true });
employeeSchema.index({ tenantId: 1, employeeCode: 1 }, { sparse: true });
employeeSchema.index({ tenantId: 1, name: 'text', department: 'text' });

export type EmployeeDocument = InferSchemaType<typeof employeeSchema> & { _id: mongoose.Types.ObjectId };

export const Employee =
  mongoose.models.Employee ?? mongoose.model('Employee', employeeSchema);
