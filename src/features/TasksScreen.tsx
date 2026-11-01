import React, { useMemo, useState } from 'react';
import {
  BellPlus,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  DailyPlanSlot,
  PriorityLevel,
  ReminderCategory,
  TaskItem,
  TaskStatus,
  WorkspaceState,
} from '../domain/types';
import { formatFriendlyDate, formatTime12h, toLocalDateKey } from '../domain/dateUtils';
import {
  Button,
  Field,
  ModalDialog,
  SelectField,
  Surface,
  TextareaField,
} from '../components/ui';

export function TasksScreen({
  state,
  busy,
  initialSection = 'tasks',
  onSectionChange,
  onOpenNewTask,
  onOpenNewReminder,
  onUpdateTask,
  onDeleteTask,
  onToggleReminder,
  onDeleteReminder,
  onAcceptDailyPlan,
  onRegenerateDailyPlan,
  onUpdatePlanSlot,
  onOpenRelatedWorkflow,
}: {
  state: WorkspaceState;
  busy: boolean;
  initialSection?: 'tasks' | 'reminders' | 'daily-plan';
  onSectionChange: (sec: 'tasks' | 'reminders' | 'daily-plan') => void;
  onOpenNewTask: () => void;
  onOpenNewReminder: () => void;
  onUpdateTask: (id: string, patch: Partial<TaskItem>) => void;
  onDeleteTask: (task: TaskItem) => void;
  onToggleReminder: (id: string, completed: boolean) => void;
  onDeleteReminder: (id: string) => void;
  onAcceptDailyPlan: () => void;
  onRegenerateDailyPlan: () => void;
  onUpdatePlanSlot: (
    slotId: string,
    patch: { startTime?: string; endTime?: string; title?: string },
  ) => void;
  onOpenRelatedWorkflow: (workflowId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'All' | TaskStatus>('All');
  const [reminderFilter, setReminderFilter] = useState<'All' | ReminderCategory>('All');
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editingSlot, setEditingSlot] = useState<DailyPlanSlot | null>(null);

  // Edit task form state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<PriorityLevel>('Medium');
  const [editStatus, setEditStatus] = useState<TaskStatus>('To Do');
  const [editDue, setEditDue] = useState('');

  // Edit slot state
  const [slotTitle, setSlotTitle] = useState('');
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('10:00');

  const todayKey = toLocalDateKey(new Date());

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'All') return state.tasks;
    return state.tasks.filter((t) => t.status === statusFilter);
  }, [state.tasks, statusFilter]);

  const filteredReminders = useMemo(() => {
    if (reminderFilter === 'All') return state.reminders;
    return state.reminders.filter((r) => r.category === reminderFilter);
  }, [state.reminders, reminderFilter]);

  const openEditTask = (task: TaskItem) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description);
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditDue(task.dueDate);
  };

  const handleSaveTaskEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;
    onUpdateTask(editingTask.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      priority: editPriority,
      status: editStatus,
      dueDate: editDue,
    });
    setEditingTask(null);
  };

  const openEditSlot = (slot: DailyPlanSlot) => {
    setEditingSlot(slot);
    setSlotTitle(slot.title);
    setSlotStart(slot.startTime);
    setSlotEnd(slot.endTime);
  };

  const handleSaveSlotEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot || !slotTitle.trim()) return;
    onUpdatePlanSlot(editingSlot.id, {
      title: slotTitle.trim(),
      startTime: slotStart,
      endTime: slotEnd,
    });
    setEditingSlot(null);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Tasks, reminders, and daily plan"
          className="flex flex-wrap items-center gap-2"
        >
          <Button
            role="tab"
            aria-selected={initialSection === 'tasks'}
            tone={initialSection === 'tasks' ? 'primary' : 'quiet'}
            onClick={() => onSectionChange('tasks')}
          >
            Tasks ({state.tasks.filter((t) => t.status !== 'Completed').length})
          </Button>
          <Button
            role="tab"
            aria-selected={initialSection === 'reminders'}
            tone={initialSection === 'reminders' ? 'primary' : 'quiet'}
            onClick={() => onSectionChange('reminders')}
          >
            Reminders ({state.reminders.filter((r) => !r.completed).length})
          </Button>
          <Button
            role="tab"
            aria-selected={initialSection === 'daily-plan'}
            tone={initialSection === 'daily-plan' ? 'primary' : 'quiet'}
            onClick={() => onSectionChange('daily-plan')}
          >
            Daily plan
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {initialSection === 'reminders' ? (
            <Button onClick={onOpenNewReminder}>
              <BellPlus className="h-4 w-4" aria-hidden="true" />
              Create reminder
            </Button>
          ) : initialSection === 'daily-plan' ? (
            <>
              <Button tone="quiet" disabled={busy} onClick={onRegenerateDailyPlan}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Regenerate plan
              </Button>
              <Button
                disabled={busy || state.dailyPlanAccepted}
                onClick={onAcceptDailyPlan}
              >
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                {state.dailyPlanAccepted ? 'Plan accepted' : 'Accept plan'}
              </Button>
            </>
          ) : (
            <Button onClick={onOpenNewTask}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add task
            </Button>
          )}
        </div>
      </div>

      {/* SECTION 1: TASKS */}
      {initialSection === 'tasks' ? (
        <Surface className="divide-y divide-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Tasks & AI estimates</h2>
              <p className="text-xs text-muted">
                Priority, estimated duration, and optimal focus window computed automatically.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'To Do', 'In Progress', 'Completed'] as const).map((st) => (
                <Button
                  key={st}
                  tone={statusFilter === st ? 'primary' : 'quiet'}
                  className="px-3"
                  onClick={() => setStatusFilter(st)}
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="space-y-3 p-6">
              <p className="text-sm text-muted">
                No tasks in "{statusFilter}". Add a task to get AI time estimates and schedule slots.
              </p>
              <Button onClick={onOpenNewTask}>Add first task</Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {filteredTasks.map((task) => {
                const isDone = task.status === 'Completed';
                return (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 sm:flex-nowrap"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <button
                        type="button"
                        aria-label={
                          isDone
                            ? `Mark "${task.title}" incomplete`
                            : `Complete "${task.title}"`
                        }
                        onClick={() =>
                          onUpdateTask(task.id, {
                            status: isDone ? 'To Do' : 'Completed',
                          })
                        }
                        className="mt-0.5 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1 space-y-1 pt-1">
                        <p
                          className={`text-base font-medium ${
                            isDone ? 'text-muted line-through' : 'text-foreground'
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.description ? (
                          <p className="text-sm text-muted">{task.description}</p>
                        ) : null}
                        <p className="text-xs text-muted tabular-nums">
                          <span
                            className={
                              task.priority === 'High'
                                ? 'font-semibold text-warning'
                                : task.priority === 'Medium'
                                  ? 'font-medium text-foreground'
                                  : 'text-muted'
                            }
                          >
                            {task.priority} priority
                          </span>
                          {' · '}
                          {task.status}
                          {' · '}Due {formatFriendlyDate(task.dueDate, todayKey)}
                          {' · '}Est. {task.estimatedMinutes} min
                          {' · '}Best slot: {task.bestTimeWindow}
                          {task.tags.length > 0 ? ` · ${task.tags.join(', ')}` : ''}
                          {task.pendingSync ? ' · Queued offline' : ''}
                        </p>
                        {task.relatedWorkflowId ? (
                          <button
                            type="button"
                            onClick={() => onOpenRelatedWorkflow(task.relatedWorkflowId!)}
                            className="inline-flex min-h-11 items-center text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            View linked workflow
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 pl-14 sm:pl-0">
                      <Button
                        tone="quiet"
                        className="px-3"
                        aria-label={`Edit "${task.title}"`}
                        onClick={() => openEditTask(task)}
                      >
                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        tone="quiet"
                        className="px-3"
                        aria-label={`Delete "${task.title}"`}
                        onClick={() => onDeleteTask(task)}
                      >
                        <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>
      ) : null}

      {/* SECTION 2: SMART REMINDERS */}
      {initialSection === 'reminders' ? (
        <Surface className="divide-y divide-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Smart reminders</h2>
              <p className="text-xs text-muted">
                One-time, recurring, deadline, meeting, and AI follow-up triggers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                ['All', 'Meeting', 'Deadline', 'Recurring', 'One-time', 'AI follow-up'] as const
              ).map((cat) => (
                <Button
                  key={cat}
                  tone={reminderFilter === cat ? 'primary' : 'quiet'}
                  className="px-3"
                  onClick={() => setReminderFilter(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {filteredReminders.length === 0 ? (
            <div className="space-y-3 p-6">
              <p className="text-sm text-muted">No reminders in "{reminderFilter}".</p>
              <Button onClick={onOpenNewReminder}>Create reminder</Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {filteredReminders.map((rem) => (
                <li
                  key={rem.id}
                  className="flex items-start justify-between gap-3 px-5 py-4"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <button
                      type="button"
                      aria-label={
                        rem.completed
                          ? `Re-arm reminder "${rem.title}"`
                          : `Complete reminder "${rem.title}"`
                      }
                      onClick={() => onToggleReminder(rem.id, !rem.completed)}
                      className="mt-0.5 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {rem.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Clock className="h-5 w-5 text-primary" />
                      )}
                    </button>

                    <div className="min-w-0 space-y-1 pt-1">
                      <p
                        className={`text-base font-medium ${
                          rem.completed ? 'text-muted line-through' : 'text-foreground'
                        }`}
                      >
                        {rem.title}
                      </p>
                      <p className="text-xs text-muted tabular-nums">
                        <span className="font-medium text-foreground">{rem.triggerAt}</span>
                        {' · '}
                        {rem.category}
                        {rem.recurrence ? ` (${rem.recurrence})` : ''}
                        {' · '}
                        {rem.pushEnabled ? 'Push + local WorkManager' : 'In-app only'}
                        {rem.pendingSync ? ' · Pending offline sync' : ''}
                      </p>
                    </div>
                  </div>

                  <Button
                    tone="quiet"
                    className="shrink-0 px-3"
                    aria-label={`Delete reminder "${rem.title}"`}
                    onClick={() => onDeleteReminder(rem.id)}
                  >
                    <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      ) : null}

      {/* SECTION 3: AI DAILY PLANNER */}
      {initialSection === 'daily-plan' ? (
        <Surface className="divide-y divide-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Your plan for today</h2>
              <p className="text-xs text-muted">
                Balanced across connected calendar meetings, urgent deadlines, and focus energy.
              </p>
            </div>
            <span className="text-xs font-medium text-primary">
              {state.dailyPlanAccepted ? 'Accepted & locked for today' : 'Draft schedule · Editable'}
            </span>
          </div>

          <ul className="divide-y divide-border/50">
            {state.dailyPlan.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:flex-nowrap"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-primary tabular-nums">
                    {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                    {' · '}
                    <span className="font-normal text-muted capitalize">{slot.kind} block</span>
                  </p>
                  <p className="text-base font-medium text-foreground">{slot.title}</p>
                  <p className="text-xs text-muted">{slot.note}</p>
                  {slot.conflictWarning ? (
                    <p className="text-xs font-medium text-warning">{slot.conflictWarning}</p>
                  ) : null}
                </div>

                <Button
                  tone="quiet"
                  className="shrink-0"
                  aria-label={`Reschedule "${slot.title}"`}
                  onClick={() => openEditSlot(slot)}
                >
                  Reschedule
                </Button>
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}

      {/* Edit Task Modal */}
      <ModalDialog
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        title="Edit task"
        description="Adjust priority, status, or due date."
      >
        <form onSubmit={handleSaveTaskEdit} className="space-y-4">
          <Field
            id="edit-task-title"
            label="Task title"
            required
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <TextareaField
            id="edit-task-desc"
            label="Description"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectField
              id="edit-task-priority"
              label="Priority"
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </SelectField>

            <SelectField
              id="edit-task-status"
              label="Status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </SelectField>

            <Field
              id="edit-task-due"
              type="date"
              label="Due date"
              value={editDue}
              onChange={(e) => setEditDue(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button tone="quiet" onClick={() => setEditingTask(null)}>
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </ModalDialog>

      {/* Reschedule Daily Plan Slot Modal */}
      <ModalDialog
        open={Boolean(editingSlot)}
        onClose={() => setEditingSlot(null)}
        title="Reschedule plan block"
        description="Update block timing or focus title."
      >
        <form onSubmit={handleSaveSlotEdit} className="space-y-4">
          <Field
            id="edit-slot-title"
            label="Block title"
            required
            value={slotTitle}
            onChange={(e) => setSlotTitle(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="edit-slot-start"
              type="time"
              label="Start time"
              value={slotStart}
              onChange={(e) => setSlotStart(e.target.value)}
            />
            <Field
              id="edit-slot-end"
              type="time"
              label="End time"
              value={slotEnd}
              onChange={(e) => setSlotEnd(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button tone="quiet" onClick={() => setEditingSlot(null)}>
              Cancel
            </Button>
            <Button type="submit">Update schedule</Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
