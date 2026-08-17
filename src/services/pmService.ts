import { Employee } from '../models/Employee.js';
import { PmProject } from '../models/PmProject.js';
import { PmTask } from '../models/PmTask.js';
import { User } from '../models/User.js';
import { createAndEmitNotification } from './notify.js';

export function isoDateOnly(value: Date | string = new Date()): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function isPmTaskOverdue(
  task: { deadline?: string | null; status?: string | null },
  now = new Date(),
): boolean {
  if (String(task.status ?? '') === 'completed') return false;
  const deadline = isoDateOnly(String(task.deadline ?? ''));
  if (!deadline) return false;
  return deadline < isoDateOnly(now);
}

export function startOfTodayIso(now = new Date()): string {
  return isoDateOnly(now);
}

export async function recalcProjectProgress(projectId: string): Promise<void> {
  const id = String(projectId ?? '').trim();
  if (!id) return;
  const tasks = await PmTask.find({ projectId: id }).select('status').lean();
  const taskCount = tasks.length;
  const completedTaskCount = tasks.filter((row) => String(row.status) === 'completed').length;
  const progress = taskCount === 0 ? 0 : Math.round((completedTaskCount / taskCount) * 100);
  await PmProject.findByIdAndUpdate(id, { taskCount, completedTaskCount, progress });
}

export async function deleteTasksForProject(projectId: string): Promise<void> {
  const id = String(projectId ?? '').trim();
  if (!id) return;
  await PmTask.deleteMany({ projectId: id });
}

type ActivityActor = {
  userId?: string;
  userName?: string;
};

export function activityEntry(message: string, actor?: ActivityActor) {
  return {
    at: new Date(),
    userId: actor?.userId ?? '',
    userName: actor?.userName ?? '',
    message,
  };
}

export async function notifyTaskAssigned(input: {
  tenantId?: string;
  taskId: string;
  taskName: string;
  projectName?: string;
  assignedToEmail?: string;
}): Promise<void> {
  const email = String(input.assignedToEmail ?? '').trim().toLowerCase();
  if (!email) return;
  const user = await User.findOne({ email }).select('_id').lean() as { _id?: unknown } | null;
  if (!user?._id) return;
  const projectBit = input.projectName ? ` on ${input.projectName}` : '';
  await createAndEmitNotification({
    tenantId: input.tenantId,
    userId: String(user._id),
    type: 'task_assigned',
    message: `New task assigned: ${input.taskName}${projectBit}`,
    refId: input.taskId,
  });
}

export async function resolveEmployeeSnapshot(employeeId: string): Promise<{
  id: string;
  name: string;
  email: string;
} | null> {
  const id = String(employeeId ?? '').trim();
  if (!id) return null;
  const employee = await Employee.findById(id).select('name email').lean() as {
    _id?: unknown;
    name?: string;
    email?: string;
  } | null;
  if (!employee) return null;
  return {
    id: String(employee._id),
    name: String(employee.name ?? '').trim(),
    email: String(employee.email ?? '').trim().toLowerCase(),
  };
}

export async function findEmployeeByUserEmail(email: string, tenantId: string) {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized) return null;
  return Employee.findOne({ tenantId, email: normalized }).select('_id name email').lean() as Promise<{
    _id?: unknown;
    name?: string;
    email?: string;
  } | null>;
}
