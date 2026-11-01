import type {
  CalendarEvent,
  DailyPlanSlot,
  DocumentAsset,
  MeetingChecklistItem,
  MeetingPrepBrief,
  NextBestActionResult,
  OfflineMutation,
  PriorityLevel,
  TaskItem,
  Workflow,
  WorkspaceState,
} from './types.ts';
import {
  addDaysToDateKey,
  formatFriendlyDate,
  formatTime12h,
  minutesToTime24,
  timeToMinutes,
} from './dateUtils.ts';

export function estimateTaskAttributes(
  title: string,
  description: string,
  dueDate: string,
  todayKey: string,
): {
  priority: PriorityLevel;
  estimatedMinutes: number;
  bestTimeWindow: string;
} {
  const text = `${title} ${description}`.toLowerCase();
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  let priority: PriorityLevel = 'Medium';
  if (
    dueDate <= tomorrowKey ||
    text.includes('urgent') ||
    text.includes('review') ||
    text.includes('architecture') ||
    text.includes('submit') ||
    text.includes('presentation') ||
    text.includes('deadline')
  ) {
    priority = 'High';
  } else if (text.includes('cleanup') || text.includes('archive') || text.includes('read')) {
    priority = 'Low';
  }

  let estimatedMinutes = 35;
  if (text.includes('deck') || text.includes('proposal') || text.includes('architecture')) {
    estimatedMinutes = 60;
  } else if (text.includes('email') || text.includes('reply') || text.includes('remind')) {
    estimatedMinutes = 20;
  }

  const bestTimeWindow =
    priority === 'High'
      ? '9:00 AM – 10:30 AM (Peak morning focus)'
      : priority === 'Medium'
        ? '1:30 PM – 2:30 PM (Afternoon block)'
        : '4:30 PM – 5:00 PM (Wrap-up window)';

  return { priority, estimatedMinutes, bestTimeWindow };
}

export function detectScheduleConflicts(
  events: CalendarEvent[],
  dateKey: string,
): Array<{ first: CalendarEvent; second: CalendarEvent }> {
  const dayEvents = events
    .filter((e) => e.date === dateKey)
    .slice()
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const conflicts: Array<{ first: CalendarEvent; second: CalendarEvent }> = [];
  for (let i = 0; i < dayEvents.length; i++) {
    for (let j = i + 1; j < dayEvents.length; j++) {
      const a = dayEvents[i];
      const b = dayEvents[j];
      if (timeToMinutes(b.startTime) < timeToMinutes(a.endTime)) {
        conflicts.push({ first: a, second: b });
      }
    }
  }
  return conflicts;
}

export function rankNextBestAction(
  tasks: TaskItem[],
  events: CalendarEvent[],
  workflows: Workflow[],
  todayKey: string,
): NextBestActionResult {
  // 1. Check if a high-priority workflow is waiting on human approval
  const pendingApprovalWf = workflows.find((w) => w.status === 'Waiting for Approval');
  const openTasks = tasks.filter((t) => t.status !== 'Completed');

  // Score open tasks deterministically
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const scoredTasks = openTasks
    .map((task) => {
      let score = 0;
      if (task.priority === 'High') score += 45;
      else if (task.priority === 'Medium') score += 25;
      else score += 10;

      if (task.dueDate <= todayKey) score += 40;
      else if (task.dueDate === tomorrowKey) score += 30;

      if (task.status === 'In Progress') score += 12;
      return { task, score };
    })
    .sort((a, b) => b.score - a.score);

  const topTask = scoredTasks[0]?.task;
  const todayEvents = events
    .filter((e) => e.date === todayKey)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const nextMeeting = todayEvents[0];
  const availableWindow = nextMeeting
    ? `Available focus window before ${formatTime12h(nextMeeting.startTime)}`
    : '2h uninterrupted focus window open now';

  if (topTask && scoredTasks[0].score >= 70) {
    const dueText =
      topTask.dueDate <= todayKey
        ? 'the deadline is today'
        : topTask.dueDate === tomorrowKey
          ? 'the deadline is tomorrow'
          : `it is due ${topTask.dueDate}`;

    return {
      headline: topTask.title,
      explanation: `Recommended next because ${dueText}, priority is ${topTask.priority}, and you have an ${availableWindow.toLowerCase()} (${topTask.estimatedMinutes} min estimated).`,
      availableWindow,
      urgencyLabel: `${topTask.priority} priority · ${topTask.estimatedMinutes} min`,
      targetType: 'task',
      targetId: topTask.id,
      ctaLabel: topTask.status === 'In Progress' ? 'Mark task complete' : 'Start focus task',
    };
  }

  if (pendingApprovalWf) {
    const waitingStep = pendingApprovalWf.steps.find((s) => s.status === 'Waiting for Approval');
    return {
      headline: waitingStep ? waitingStep.title : pendingApprovalWf.title,
      explanation: `Workflow "${pendingApprovalWf.title}" has completed its context gathering and needs your approval on a high-risk external step to finish.`,
      availableWindow: 'Takes under 1 minute to review',
      urgencyLabel: 'Waiting for Approval · High risk check',
      targetType: 'approval',
      targetId: pendingApprovalWf.id,
      ctaLabel: 'Review approval',
    };
  }

  if (topTask) {
    return {
      headline: topTask.title,
      explanation: `Completing "${topTask.title}" clears your top remaining task (${topTask.estimatedMinutes} min) during your ${availableWindow.toLowerCase()}.`,
      availableWindow,
      urgencyLabel: `${topTask.priority} priority · ${topTask.estimatedMinutes} min`,
      targetType: 'task',
      targetId: topTask.id,
      ctaLabel: 'Start focus task',
    };
  }

  return {
    headline: 'Review tomorrow’s schedule & preparation brief',
    explanation: 'All current tasks are completed. Reviewing tomorrow’s calendar keeps your morning friction-free.',
    availableWindow: 'Open schedule',
    urgencyLabel: 'All caught up',
    targetType: 'meeting',
    targetId: events[0]?.id || '',
    ctaLabel: 'Open meeting prep',
  };
}

export function generateDailySchedule(
  tasks: TaskItem[],
  events: CalendarEvent[],
  dateKey: string,
  variantOffset = 0,
): DailyPlanSlot[] {
  const dayEvents = events
    .filter((e) => e.date === dateKey)
    .slice()
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const conflicts = detectScheduleConflicts(events, dateKey);
  const conflictEventIds = new Set<string>();
  for (const c of conflicts) {
    conflictEventIds.add(c.first.id);
    conflictEventIds.add(c.second.id);
  }

  const openTasks = tasks
    .filter((t) => t.status !== 'Completed')
    .slice()
    .sort((a, b) => {
      const pWeight = { High: 3, Medium: 2, Low: 1 };
      if (pWeight[b.priority] !== pWeight[a.priority]) {
        return pWeight[b.priority] - pWeight[a.priority];
      }
      return a.dueDate.localeCompare(b.dueDate);
    });

  if (variantOffset % 2 === 1 && openTasks.length > 1) {
    const first = openTasks.shift()!;
    openTasks.splice(1, 0, first);
  }

  const slots: DailyPlanSlot[] = [];
  const candidateWindows = [
    { start: 9 * 60, end: 11 * 60 },
    { start: 12 * 60 + 15, end: 13 * 60 },
    { start: 13 * 60 + 30, end: 14 * 60 + 45 },
    { start: 16 * 60 + 15, end: 17 * 60 + 15 },
  ];

  // Add fixed calendar events first
  for (const ev of dayEvents) {
    slots.push({
      id: `slot_ev_${ev.id}`,
      startTime: ev.startTime,
      endTime: ev.endTime,
      title: ev.title,
      kind: 'meeting',
      note: `${ev.location} · ${ev.attendees.join(', ')}`,
      eventId: ev.id,
      conflictWarning: conflictEventIds.has(ev.id)
        ? 'Overlaps with another calendar event — review in Workflows'
        : undefined,
      accepted: true,
    });
  }

  let taskIdx = 0;
  for (const win of candidateWindows) {
    const overlapsMeeting = dayEvents.some(
      (ev) =>
        timeToMinutes(ev.startTime) < win.end && timeToMinutes(ev.endTime) > win.start,
    );
    if (overlapsMeeting) continue;

    if (taskIdx < openTasks.length) {
      const task = openTasks[taskIdx++];
      const duration = Math.min(win.end - win.start, Math.max(30, task.estimatedMinutes));
      slots.push({
        id: `slot_task_${task.id}`,
        startTime: minutesToTime24(win.start),
        endTime: minutesToTime24(win.start + duration),
        title: task.title,
        kind: 'focus',
        note: `${task.priority} priority · Due ${task.dueDate === dateKey ? 'today' : task.dueDate}`,
        taskId: task.id,
        accepted: false,
      });
    } else if (win.start === 12 * 60 + 15) {
      slots.push({
        id: 'slot_admin_inbox',
        startTime: minutesToTime24(win.start),
        endTime: minutesToTime24(win.start + 30),
        title: 'Review and respond to priority emails',
        kind: 'admin',
        note: 'Batch triage flagged messages from Gmail',
        accepted: false,
      });
    }
  }

  return slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function buildMeetingPreparation(
  event: CalendarEvent,
  documents: DocumentAsset[],
  tasks: TaskItem[],
  allEvents: CalendarEvent[],
  existingChecklist: MeetingChecklistItem[] | undefined,
  remindersExist: boolean,
  todayKey: string,
): MeetingPrepBrief {
  const conflicts = detectScheduleConflicts(allEvents, event.date).filter(
    (c) => c.first.id === event.id || c.second.id === event.id,
  );
  const otherConflict =
    conflicts.length > 0
      ? conflicts[0].first.id === event.id
        ? conflicts[0].second
        : conflicts[0].first
      : null;

  const defaultChecklist: MeetingChecklistItem[] = [
    {
      id: `${event.id}_chk_1`,
      label: `Review "${documents[0]?.title || 'meeting agenda'}" key decisions`,
      done: true,
    },
    {
      id: `${event.id}_chk_2`,
      label: 'Verify Q4 infrastructure cost figures against finance sheet',
      done: false,
    },
    {
      id: `${event.id}_chk_3`,
      label: otherConflict
        ? `Confirm reschedule of overlapping "${otherConflict.title}"`
        : 'Confirm room link and screen-sharing permissions 10m before start',
      done: false,
    },
    {
      id: `${event.id}_chk_4`,
      label: 'Send concise 3-bullet decision recap after meeting concludes',
      done: false,
    },
  ];

  const relatedTasks = tasks.filter(
    (t) =>
      t.status !== 'Completed' &&
      (t.priority === 'High' || t.tags.some((tag) => /meeting|q4|architecture|product/i.test(tag))),
  );

  return {
    eventId: event.id,
    eventTitle: event.title,
    dateLabel: formatFriendlyDate(event.date, todayKey),
    timeRange: `${formatTime12h(event.startTime)} – ${formatTime12h(event.endTime)}`,
    location: event.location,
    attendees: event.attendees,
    conflictNote: otherConflict
      ? `Schedule overlap detected with "${otherConflict.title}" (${formatTime12h(otherConflict.startTime)} – ${formatTime12h(otherConflict.endTime)}).`
      : null,
    summary: event.description,
    documents: documents.slice(0, 3),
    relatedTasks: relatedTasks.slice(0, 3),
    checklist: existingChecklist && existingChecklist.length > 0 ? existingChecklist : defaultChecklist,
    reminderSet: remindersExist,
  };
}

export function mergeOfflineMutations(
  state: WorkspaceState,
  mutations: OfflineMutation[],
): WorkspaceState {
  let nextTasks = state.tasks.map((t) => ({ ...t, pendingSync: false }));
  let nextReminders = state.reminders.map((r) => ({ ...r, pendingSync: false }));

  for (const mut of mutations) {
    if (mut.kind === 'create_task') {
      const task = mut.payload as unknown as TaskItem;
      if (!nextTasks.some((t) => t.id === task.id)) {
        nextTasks = [{ ...task, pendingSync: false }, ...nextTasks];
      }
    } else if (mut.kind === 'toggle_task') {
      const { id, status } = mut.payload as { id: string; status: TaskItem['status'] };
      nextTasks = nextTasks.map((t) =>
        t.id === id ? { ...t, status, pendingSync: false, updatedAt: mut.queuedAt } : t,
      );
    } else if (mut.kind === 'create_reminder') {
      const reminder = mut.payload as unknown as WorkspaceState['reminders'][number];
      if (!nextReminders.some((r) => r.id === reminder.id)) {
        nextReminders = [{ ...reminder, pendingSync: false }, ...nextReminders];
      }
    } else if (mut.kind === 'toggle_reminder') {
      const { id, completed } = mut.payload as { id: string; completed: boolean };
      nextReminders = nextReminders.map((r) =>
        r.id === id ? { ...r, completed, pendingSync: false } : r,
      );
    }
  }

  return {
    ...state,
    tasks: nextTasks,
    reminders: nextReminders,
  };
}
