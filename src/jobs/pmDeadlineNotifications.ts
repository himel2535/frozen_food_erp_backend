import { PmTask } from '../models/PmTask.js';
import { User } from '../models/User.js';
import { createAndEmitNotification } from '../services/notify.js';
import { isoDateOnly } from '../services/pmService.js';

const INTERVAL_MS = 15 * 60 * 1000;

async function notifyUserByEmail(input: {
  tenantId: string;
  email: string;
  type: string;
  message: string;
  refId: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  const user = await User.findOne({ email }).select('_id').lean() as { _id?: unknown } | null;
  if (!user?._id) return;
  await createAndEmitNotification({
    tenantId: input.tenantId,
    userId: String(user._id),
    type: input.type,
    message: input.message,
    refId: input.refId,
  });
}

export async function runPmDeadlineNotifications(): Promise<void> {
  const today = isoDateOnly();
  const tomorrowDate = new Date();
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = isoDateOnly(tomorrowDate);

  const overdue = await PmTask.find({
    status: { $ne: 'completed' },
    deadline: { $lt: today, $ne: '' },
    $or: [{ overdueNotifiedAt: { $exists: false } }, { overdueNotifiedAt: null }],
  })
    .limit(200)
    .lean();

  for (const task of overdue) {
    const id = String(task._id);
    await notifyUserByEmail({
      tenantId: String(task.tenantId ?? 'default'),
      email: String(task.assignedToEmail ?? ''),
      type: 'task_overdue',
      message: `Task overdue: ${String(task.name ?? 'Task')}`,
      refId: id,
    });
    await PmTask.updateOne({ _id: task._id }, { $set: { overdueNotifiedAt: new Date() } });
  }

  const dueTomorrow = await PmTask.find({
    status: { $ne: 'completed' },
    deadline: tomorrow,
    deadlineTomorrowNotifiedOn: { $ne: today },
  })
    .limit(200)
    .lean();

  for (const task of dueTomorrow) {
    const id = String(task._id);
    await notifyUserByEmail({
      tenantId: String(task.tenantId ?? 'default'),
      email: String(task.assignedToEmail ?? ''),
      type: 'task_deadline_tomorrow',
      message: `Deadline tomorrow: ${String(task.name ?? 'Task')}`,
      refId: id,
    });
    await PmTask.updateOne({ _id: task._id }, { $set: { deadlineTomorrowNotifiedOn: today } });
  }
}

export function startPmDeadlineNotificationJob(): void {
  const run = () => {
    void runPmDeadlineNotifications().catch((err) => {
      console.error('[pm] deadline notification job failed', err);
    });
  };
  setTimeout(run, 30_000);
  setInterval(run, INTERVAL_MS);
}
