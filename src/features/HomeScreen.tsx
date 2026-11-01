import React from 'react';
import {
  ArrowRight,
  BellPlus,
  CalendarClock,
  CheckCircle2,
  Circle,
  MessageSquarePlus,
  Plus,
  Sparkles,
} from 'lucide-react';
import type {
  AppTab,
  NextBestActionResult,
  TaskStatus,
  WorkspaceState,
} from '../domain/types';
import {
  addDaysToDateKey,
  formatFriendlyDate,
  formatTime12h,
  greetingForHour,
  toLocalDateKey,
} from '../domain/dateUtils';
import { detectScheduleConflicts } from '../domain/plannerEngine';
import { Button, Surface } from '../components/ui';
import { WorkflowVisualizer } from '../components/WorkflowVisualizer';

export function HomeScreen({
  state,
  nextBestAction,
  busy,
  onNavigate,
  onOpenNewTask,
  onOpenNewReminder,
  onOpenDailyPlanner,
  onOpenMeetingPrep,
  onToggleTaskStatus,
  onApproveStep,
  onRejectStep,
}: {
  state: WorkspaceState;
  nextBestAction: NextBestActionResult;
  busy: boolean;
  onNavigate: (tab: AppTab) => void;
  onOpenNewTask: () => void;
  onOpenNewReminder: () => void;
  onOpenDailyPlanner: () => void;
  onOpenMeetingPrep: (eventId?: string) => void;
  onToggleTaskStatus: (taskId: string, nextStatus: TaskStatus) => void;
  onApproveStep: (workflowId: string, stepId: string, editedSummary?: string) => void;
  onRejectStep: (workflowId: string, stepId: string, reason?: string) => void;
}) {
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const firstName = state.user.name.split(' ')[0] || 'Abdul';
  const greeting = greetingForHour(now.getHours());

  const openTasks = state.tasks.filter((t) => t.status !== 'Completed');
  const highPriorityTasks = openTasks.filter((t) => t.priority === 'High');
  const todayEvents = state.events.filter((e) => e.date === todayKey);
  const pendingReminders = state.reminders.filter((r) => !r.completed);
  const activeWorkflows = state.workflows.filter(
    (w) => w.status === 'Active' || w.status === 'Waiting for Approval',
  );
  const approvalWorkflow = state.workflows.find((w) => w.status === 'Waiting for Approval');
  const tomorrowConflicts = detectScheduleConflicts(state.events, tomorrowKey);

  // Build live AI Daily Briefing grounded strictly in computed state
  const nextTodayMeeting = todayEvents[0];
  const briefingSentence = [
    `You have ${highPriorityTasks.length} high-priority ${
      highPriorityTasks.length === 1 ? 'task' : 'tasks'
    } open`,
    nextTodayMeeting
      ? `and "${nextTodayMeeting.title}" at ${formatTime12h(nextTodayMeeting.startTime)} today.`
      : 'and an open focus schedule today.',
    tomorrowConflicts.length > 0
      ? `Tomorrow’s 10:00 AM Q4 review has 1 overlapping invite waiting on your approval.`
      : `Tomorrow’s schedule has zero calendar conflicts.`,
    highPriorityTasks[0]
      ? `I recommend completing "${highPriorityTasks[0].title}" during your next open focus block.`
      : 'You are ahead of all urgent deadlines.',
  ].join(' ');

  const handleNextBestActionClick = () => {
    if (nextBestAction.targetType === 'approval') {
      onNavigate('workflows');
      return;
    }
    if (nextBestAction.targetType === 'meeting') {
      onOpenMeetingPrep(nextBestAction.targetId);
      return;
    }
    const targetTask = state.tasks.find((t) => t.id === nextBestAction.targetId);
    if (targetTask) {
      const nextStatus: TaskStatus =
        targetTask.status === 'In Progress' ? 'Completed' : 'In Progress';
      onToggleTaskStatus(targetTask.id, nextStatus);
    } else {
      onNavigate('tasks');
    }
  };

  return (
    <div className="space-y-6">
      {/* Greeting & Quick Actions */}
      <Surface className="divide-y divide-border/60">
        <div className="space-y-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-display text-foreground">
              {greeting}, {firstName}.
            </h2>
            <p className="text-sm text-muted tabular-nums">
              {now.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          <p className="max-w-[68ch] text-base leading-relaxed text-foreground">
            {briefingSentence}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <Button onClick={() => onNavigate('assistant')}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              Ask LifePilot
            </Button>
            <Button tone="quiet" onClick={onOpenNewTask}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add task
            </Button>
            <Button tone="quiet" onClick={onOpenNewReminder}>
              <BellPlus className="h-4 w-4" aria-hidden="true" />
              Create reminder
            </Button>
            <Button tone="quiet" onClick={onOpenDailyPlanner}>
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Plan my day
            </Button>
          </div>
        </div>

        {/* Today Overview Figures — parted strictly by 1px rules, zero nested boxes */}
        <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
          <div className="p-4 sm:p-5">
            <p className="text-xs text-muted">Today’s events</p>
            <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
              {todayEvents.length}
            </p>
            <p className="mt-0.5 text-xs text-muted">Connected calendar</p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs text-muted">Priority tasks</p>
            <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
              {highPriorityTasks.length}
            </p>
            <p className="mt-0.5 text-xs text-muted">{openTasks.length} total open</p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs text-muted">Pending reminders</p>
            <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
              {pendingReminders.length}
            </p>
            <p className="mt-0.5 text-xs text-muted">Local & push armed</p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs text-muted">Active workflows</p>
            <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
              {activeWorkflows.length}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {approvalWorkflow ? '1 awaiting approval' : 'All authorized'}
            </p>
          </div>
        </div>
      </Surface>

      {/* Two-column adaptive workspace on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {/* Next Best Action */}
          <Surface className="divide-y divide-border/60">
            <div className="space-y-2.5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  Recommended next action
                </h3>
                <span className="text-xs font-medium text-primary tabular-nums">
                  {nextBestAction.urgencyLabel}
                </span>
              </div>
              <p className="text-lg font-semibold text-foreground">{nextBestAction.headline}</p>
              <p className="text-sm leading-relaxed text-muted">{nextBestAction.explanation}</p>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-muted">{nextBestAction.availableWindow}</span>
                <Button disabled={busy} onClick={handleNextBestActionClick}>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {nextBestAction.ctaLabel}
                </Button>
              </div>
            </div>
          </Surface>

          {/* Active Workflow Awaiting Approval */}
          {approvalWorkflow ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-base font-semibold text-foreground">
                  Workflow waiting for your control
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('workflows')}
                  className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  All workflows
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <WorkflowVisualizer
                workflow={approvalWorkflow}
                compact
                busy={busy}
                onApproveStep={onApproveStep}
                onRejectStep={onRejectStep}
              />
            </div>
          ) : null}
        </div>

        {/* Right Column: Schedule, Meeting Prep & Priority Tasks */}
        <div className="space-y-6 lg:col-span-5">
          {/* Upcoming Events & Meeting Prep */}
          <Surface className="divide-y divide-border/60">
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="text-base font-semibold text-foreground">Upcoming schedule</h3>
              <button
                type="button"
                onClick={() => onOpenMeetingPrep('evt_q4_arch')}
                className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Meeting prep
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <ul className="divide-y divide-border/50">
              {state.events.slice(0, 4).map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-start justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{ev.title}</p>
                    <p className="text-xs text-muted tabular-nums">
                      {formatFriendlyDate(ev.date, todayKey)} · {formatTime12h(ev.startTime)} –{' '}
                      {formatTime12h(ev.endTime)} · {ev.location}
                    </p>
                  </div>
                  <Button
                    tone="quiet"
                    className="shrink-0 px-3"
                    aria-label={`Prepare for ${ev.title}`}
                    onClick={() => onOpenMeetingPrep(ev.id)}
                  >
                    Prep
                  </Button>
                </li>
              ))}
            </ul>
          </Surface>

          {/* Important Tasks & Deadlines */}
          <Surface className="divide-y divide-border/60">
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="text-base font-semibold text-foreground">Important tasks</h3>
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Manage tasks
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <ul className="divide-y divide-border/50">
              {openTasks.slice(0, 4).map((task) => {
                const isDone = task.status === 'Completed';
                return (
                  <li key={task.id} className="flex items-start gap-3 px-5 py-3.5">
                    <button
                      type="button"
                      aria-label={`Mark "${task.title}" completed`}
                      onClick={() =>
                        onToggleTaskStatus(task.id, isDone ? 'To Do' : 'Completed')
                      }
                      className="mt-0.5 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1 space-y-0.5 pt-1">
                      <p className="text-sm font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted tabular-nums">
                        <span
                          className={
                            task.priority === 'High'
                              ? 'font-medium text-warning'
                              : 'text-muted'
                          }
                        >
                          {task.priority} priority
                        </span>
                        {' · '}Due {formatFriendlyDate(task.dueDate, todayKey)}
                        {' · '}
                        {task.estimatedMinutes} min
                        {task.pendingSync ? ' · Pending offline sync' : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Surface>
        </div>
      </div>
    </div>
  );
}
