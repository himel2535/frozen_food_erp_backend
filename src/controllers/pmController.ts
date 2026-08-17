import type { Request, Response } from 'express';
import { Employee } from '../models/Employee.js';
import { PmProject } from '../models/PmProject.js';
import { PmTask } from '../models/PmTask.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/ApiError.js';
import { serializeLeanDoc } from '../controllers/crudFactory.js';
import {
  activityEntry,
  deleteTasksForProject,
  findEmployeeByUserEmail,
  isoDateOnly,
  isPmTaskOverdue,
  notifyTaskAssigned,
  recalcProjectProgress,
  resolveEmployeeSnapshot,
} from '../services/pmService.js';

type AuthUser = { _id?: unknown; email?: string; name?: string; tenantId?: string };

function authUser(req: Request): AuthUser {
  return ((req as Request & { user?: AuthUser }).user ?? {}) as AuthUser;
}

function tenantIdFrom(req: Request): string {
  return String(req.query.tenantId ?? authUser(req).tenantId ?? 'default');
}

function withOverdue(doc: Record<string, unknown>) {
  return {
    ...serializeLeanDoc(doc),
    overdue: isPmTaskOverdue({
      deadline: String(doc.deadline ?? ''),
      status: String(doc.status ?? ''),
    }),
  };
}

export const getPmProjectSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = tenantIdFrom(req);
  const today = isoDateOnly();
  const [totalProjects, activeProjects, completedProjects, overdueTasks] = await Promise.all([
    PmProject.countDocuments({ tenantId }),
    PmProject.countDocuments({ tenantId, status: 'active' }),
    PmProject.countDocuments({ tenantId, status: 'completed' }),
    PmTask.countDocuments({
      tenantId,
      status: { $ne: 'completed' },
      deadline: { $lt: today, $ne: '' },
    }),
  ]);
  sendSuccess(res, { totalProjects, activeProjects, completedProjects, overdueTasks });
});

export const listMyPmTasks = asyncHandler(async (req: Request, res: Response) => {
  const user = authUser(req);
  const tenantId = tenantIdFrom(req);
  const empty = { overdue: [], today: [], upcoming: [], completed: [] };
  const employee = await findEmployeeByUserEmail(String(user.email ?? ''), tenantId);
  if (!employee) {
    sendSuccess(res, empty);
    return;
  }

  const tasks = await PmTask.find({
    tenantId,
    assignedTo: String(employee._id),
  })
    .sort({ deadline: 1, createdAt: -1 })
    .limit(500)
    .lean();

  const today = isoDateOnly();
  const grouped = {
    overdue: [] as Record<string, unknown>[],
    today: [] as Record<string, unknown>[],
    upcoming: [] as Record<string, unknown>[],
    completed: [] as Record<string, unknown>[],
  };

  for (const task of tasks) {
    const row = withOverdue(task as Record<string, unknown>);
    const status = String(task.status ?? '');
    const deadline = isoDateOnly(String(task.deadline ?? ''));
    if (status === 'completed') {
      grouped.completed.push(row);
      continue;
    }
    if (deadline && deadline < today) {
      grouped.overdue.push(row);
      continue;
    }
    if (deadline === today) {
      grouped.today.push(row);
      continue;
    }
    grouped.upcoming.push(row);
  }

  sendSuccess(res, grouped);
});

export const getPmTeamOverview = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = tenantIdFrom(req);
  const today = isoDateOnly();
  const employeeId = String(req.query.employeeId ?? '').trim();
  const projectId = String(req.query.projectId ?? '').trim();
  const search = String(req.query.search ?? req.query.q ?? '').trim();

  const employeeFilter: Record<string, unknown> = { tenantId };
  if (employeeId) employeeFilter._id = employeeId;
  if (search) {
    employeeFilter.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  const employees = await Employee.find(employeeFilter)
    .select('name email designation department imageUrl status')
    .sort({ name: 1 })
    .limit(100)
    .lean();

  const taskMatch: Record<string, unknown> = { tenantId };
  if (projectId && projectId !== 'all') taskMatch.projectId = projectId;
  if (employeeId) taskMatch.assignedTo = employeeId;

  const stats = await PmTask.aggregate<{
    _id: string;
    total: number;
    todo: number;
    inProgress: number;
    completed: number;
    overdue: number;
  }>([
    { $match: taskMatch },
    {
      $group: {
        _id: '$assignedTo',
        total: { $sum: 1 },
        todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$status', 'completed'] },
                  { $gt: ['$deadline', ''] },
                  { $lt: ['$deadline', today] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const statsById = new Map(stats.map((row) => [String(row._id), row]));
  const rows = employees.map((employee) => {
    const id = String(employee._id);
    const stat = statsById.get(id);
    const total = stat?.total ?? 0;
    const completed = stat?.completed ?? 0;
    return {
      id,
      name: String(employee.name ?? ''),
      email: String(employee.email ?? ''),
      designation: String(employee.designation ?? ''),
      department: String(employee.department ?? ''),
      imageUrl: String(employee.imageUrl ?? ''),
      status: String(employee.status ?? 'active'),
      totalTasks: total,
      todo: stat?.todo ?? 0,
      inProgress: stat?.inProgress ?? 0,
      completed,
      overdue: stat?.overdue ?? 0,
      pending: (stat?.todo ?? 0) + (stat?.inProgress ?? 0),
      progress: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalEmployees += 1;
      acc.totalTasks += row.totalTasks;
      acc.pending += row.pending;
      acc.inProgress += row.inProgress;
      acc.completed += row.completed;
      acc.overdue += row.overdue;
      return acc;
    },
    { totalEmployees: 0, totalTasks: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0 },
  );

  sendSuccess(res, { rows, totals });
});

const TASK_STATUSES = new Set(['todo', 'in-progress', 'completed']);

export const patchPmTaskStatus = asyncHandler(async (req: Request, res: Response) => {
  const status = String((req.body as { status?: string })?.status ?? '').trim();
  if (!TASK_STATUSES.has(status)) {
    throw badRequest('Status must be todo, in-progress, or completed');
  }
  const doc = await PmTask.findById(req.params.id);
  if (!doc) throw notFound('Task not found');

  const previous = String(doc.status ?? '');
  if (previous !== status) {
    const user = authUser(req);
    const labels: Record<string, string> = {
      todo: 'To Do',
      'in-progress': 'In Progress',
      completed: 'Completed',
    };
    doc.status = status as typeof doc.status;
    doc.activity = [
      ...(doc.activity ?? []),
      activityEntry(`Status changed to ${labels[status] ?? status}`, {
        userId: String(user._id ?? ''),
        userName: String(user.name ?? ''),
      }),
    ];
    await doc.save();
    await recalcProjectProgress(String(doc.projectId));
  }

  sendSuccess(res, withOverdue(doc.toJSON() as Record<string, unknown>));
});

export async function afterPmTaskCreated(doc: {
  _id: unknown;
  tenantId?: string;
  toJSON: () => Record<string, unknown>;
}): Promise<void> {
  const json = doc.toJSON();
  const taskId = String(doc._id);
  await recalcProjectProgress(String(json.projectId ?? ''));
  await notifyTaskAssigned({
    tenantId: String(json.tenantId ?? doc.tenantId ?? 'default'),
    taskId,
    taskName: String(json.name ?? 'Task'),
    projectName: String(json.projectName ?? ''),
    assignedToEmail: String(json.assignedToEmail ?? ''),
  });
}

export async function afterPmTaskUpdated(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): Promise<void> {
  const projectId = String(next.projectId ?? previous.projectId ?? '');
  await recalcProjectProgress(projectId);
  const taskId = String(next._id ?? next.id ?? '');
  const prevStatus = String(previous.status ?? '');
  const nextStatus = String(next.status ?? '');
  if (taskId && prevStatus && nextStatus && prevStatus !== nextStatus) {
    const labels: Record<string, string> = {
      todo: 'To Do',
      'in-progress': 'In Progress',
      completed: 'Completed',
    };
    await PmTask.updateOne(
      { _id: taskId },
      { $push: { activity: activityEntry(`Status changed to ${labels[nextStatus] ?? nextStatus}`) } },
    );
  }
  const prevAssignee = String(previous.assignedTo ?? '');
  const nextAssignee = String(next.assignedTo ?? '');
  if (nextAssignee && nextAssignee !== prevAssignee) {
    const snap = await resolveEmployeeSnapshot(nextAssignee);
    const email = String(next.assignedToEmail ?? snap?.email ?? '');
    if (snap && taskId) {
      await PmTask.updateOne(
        { _id: taskId },
        { $set: { assignedToName: snap.name, assignedToEmail: snap.email } },
      );
    }
    await notifyTaskAssigned({
      tenantId: String(next.tenantId ?? 'default'),
      taskId,
      taskName: String(next.name ?? 'Task'),
      projectName: String(next.projectName ?? ''),
      assignedToEmail: email || snap?.email,
    });
  }
}

export async function afterPmTaskDeleted(doc: Record<string, unknown>): Promise<void> {
  await recalcProjectProgress(String(doc.projectId ?? ''));
}

export async function afterPmProjectDeleted(doc: Record<string, unknown>): Promise<void> {
  const id = String(doc._id ?? doc.id ?? '');
  if (!id) return;
  await deleteTasksForProject(id);
}
