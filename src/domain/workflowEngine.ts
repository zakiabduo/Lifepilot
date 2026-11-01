import type {
  CalendarEvent,
  DocumentAsset,
  ReminderCategory,
  RiskLevel,
  TaskItem,
  Workflow,
  WorkflowStatus,
  WorkflowStep,
} from './types.ts';
import { addDaysToDateKey, formatTime12h, minutesToTime24, timeToMinutes } from './dateUtils.ts';

export const AGENT_PIPELINE_STAGES = [
  'Understand Intent',
  'Collect Relevant Context',
  'Create Action Plan',
  'Generate Workflow',
  'Check Permissions & Risk',
  'Request User Approval / Execute',
];

/**
 * Advances a workflow sequentially through Pending/Planning/Running steps.
 * High-risk or explicit `requiresApproval` steps stop at `Waiting for Approval`
 * so the human always remains in control before external mutations occur.
 */
export function advanceWorkflowExecution(workflow: Workflow, nowIso: string): Workflow {
  if (
    workflow.status === 'Paused' ||
    workflow.status === 'Cancelled' ||
    workflow.status === 'Completed'
  ) {
    return workflow;
  }

  const nextSteps: WorkflowStep[] = workflow.steps.map((s) => ({ ...s }));
  let workflowStatus: WorkflowStatus = 'Active';

  for (let i = 0; i < nextSteps.length; i++) {
    const step = nextSteps[i];
    if (step.status === 'Completed') {
      continue;
    }
    if (step.status === 'Failed') {
      workflowStatus = 'Failed';
      break;
    }
    if (step.status === 'Waiting for Approval') {
      workflowStatus = 'Waiting for Approval';
      break;
    }
    if (step.requiresApproval || step.riskLevel === 'High') {
      nextSteps[i] = {
        ...step,
        status: 'Waiting for Approval',
      };
      workflowStatus = 'Waiting for Approval';
      break;
    }

    nextSteps[i] = {
      ...step,
      status: 'Completed',
      outputNote:
        step.outputNote ||
        `Executed via ${step.toolName} (${step.riskLevel.toLowerCase()} risk authorized).`,
    };
  }

  const allCompleted = nextSteps.every((s) => s.status === 'Completed');
  if (allCompleted) {
    workflowStatus = 'Completed';
  }

  return {
    ...workflow,
    status: workflowStatus,
    updatedAt: nowIso,
    steps: nextSteps,
  };
}

export function approveWorkflowStep(
  workflow: Workflow,
  stepId: string,
  editedActionSummary: string | undefined,
  nowIso: string,
): Workflow {
  const updatedSteps = workflow.steps.map((step) => {
    if (step.id !== stepId) return step;
    const summary = editedActionSummary?.trim() || step.actionSummary || step.description;
    return {
      ...step,
      actionSummary: summary,
      status: 'Completed' as const,
      outputNote: `Approved by user and executed: ${summary}`,
    };
  });

  return advanceWorkflowExecution(
    {
      ...workflow,
      status: 'Active',
      updatedAt: nowIso,
      steps: updatedSteps,
    },
    nowIso,
  );
}

export function rejectWorkflowStep(
  workflow: Workflow,
  stepId: string,
  reason: string | undefined,
  nowIso: string,
): Workflow {
  const updatedSteps = workflow.steps.map((step) => {
    if (step.id !== stepId) return step;
    return {
      ...step,
      status: 'Completed' as const,
      outputNote: `Skipped per user rejection${reason ? `: ${reason}` : '.'}`,
    };
  });

  return advanceWorkflowExecution(
    {
      ...workflow,
      status: 'Active',
      updatedAt: nowIso,
      steps: updatedSteps,
    },
    nowIso,
  );
}

export function pauseWorkflow(workflow: Workflow, nowIso: string): Workflow {
  if (workflow.status === 'Completed' || workflow.status === 'Cancelled') {
    return workflow;
  }
  return {
    ...workflow,
    status: 'Paused',
    updatedAt: nowIso,
  };
}

export function resumeWorkflow(workflow: Workflow, nowIso: string): Workflow {
  if (workflow.status !== 'Paused') return workflow;
  return advanceWorkflowExecution(
    {
      ...workflow,
      status: 'Active',
      updatedAt: nowIso,
    },
    nowIso,
  );
}

export function cancelWorkflow(workflow: Workflow, nowIso: string): Workflow {
  return {
    ...workflow,
    status: 'Cancelled',
    updatedAt: nowIso,
  };
}

export function retryWorkflowStep(
  workflow: Workflow,
  stepId: string,
  nowIso: string,
): Workflow {
  const updatedSteps = workflow.steps.map((step) => {
    if (step.id !== stepId) return step;
    return {
      ...step,
      status: 'Pending' as const,
      errorReason: undefined,
      recoveryHint: undefined,
      outputNote: 'Recovered after retry check.',
    };
  });

  return advanceWorkflowExecution(
    {
      ...workflow,
      status: 'Active',
      updatedAt: nowIso,
      steps: updatedSteps,
    },
    nowIso,
  );
}

export interface GoalPlanContext {
  todayKey: string;
  events: CalendarEvent[];
  documents: DocumentAsset[];
  tasks: TaskItem[];
}

export interface PlannedAgentOutcome {
  understoodIntent: string;
  assistantReply: string;
  workflow: Workflow;
  suggestedReminder?: {
    title: string;
    date: string;
    time: string;
    category: ReminderCategory;
  };
  suggestedTask?: {
    title: string;
    description: string;
    priority: 'High' | 'Medium' | 'Low';
    dueDate: string;
    estimatedMinutes: number;
    bestTimeWindow: string;
    tags: string[];
  };
}

export function classifyStepRisk(toolName: string, description: string): RiskLevel {
  const text = `${toolName} ${description}`.toLowerCase();
  if (
    text.includes('email') ||
    text.includes('gmail') ||
    text.includes('send') ||
    text.includes('reschedule') ||
    text.includes('modify external') ||
    text.includes('invite') ||
    text.includes('delete')
  ) {
    return 'High';
  }
  if (
    text.includes('reminder') ||
    text.includes('calendar event') ||
    text.includes('block') ||
    text.includes('create task')
  ) {
    return 'Medium';
  }
  return 'Low';
}

export function planGoalWorkflow(
  userPrompt: string,
  ctx: GoalPlanContext,
  nowIso: string,
): PlannedAgentOutcome {
  const lower = userPrompt.toLowerCase();
  const tomorrowKey = addDaysToDateKey(ctx.todayKey, 1);
  const wfId = `wf_${Date.now().toString(36)}`;

  const isMeetingFlow =
    lower.includes('meeting') ||
    lower.includes('prepare') ||
    lower.includes('document') ||
    lower.includes('conflict');

  const isReminderOnly =
    lower.includes('remind') && !isMeetingFlow && !lower.includes('schedule');

  if (isMeetingFlow) {
    const targetDate = lower.includes('tomorrow') ? tomorrowKey : ctx.todayKey;
    const dayEvents = ctx.events.filter((e) => e.date === targetDate);
    const primaryMeeting =
      dayEvents[0] ||
      ctx.events[0] || {
        id: 'evt_fallback',
        title: 'Project Strategy Sync',
        date: tomorrowKey,
        startTime: '10:00',
        endTime: '11:00',
        location: 'Google Meet',
        attendees: ['Team'],
        description: 'Review milestones and open action items.',
        source: 'Google Calendar',
      };

    const overlapping = dayEvents.find(
      (e) =>
        e.id !== primaryMeeting.id &&
        timeToMinutes(e.startTime) < timeToMinutes(primaryMeeting.endTime) &&
        timeToMinutes(e.endTime) > timeToMinutes(primaryMeeting.startTime),
    );

    const reminderMinutes = Math.max(7 * 60, timeToMinutes(primaryMeeting.startTime) - 120);
    const reminderTime = minutesToTime24(reminderMinutes);
    const matchedDocs = ctx.documents.slice(0, 2).map((d) => d.title).join(', ');

    const rawSteps: WorkflowStep[] = [
      {
        id: `${wfId}_s1`,
        order: 1,
        title: 'Find Calendar Event',
        description: `Locate "${primaryMeeting.title}" on ${primaryMeeting.date} (${formatTime12h(primaryMeeting.startTime)} – ${formatTime12h(primaryMeeting.endTime)}).`,
        toolName: 'GoogleCalendar.ReadEvents',
        riskLevel: 'Low',
        requiresApproval: false,
        status: 'Pending',
        outputNote: `Matched "${primaryMeeting.title}" at ${formatTime12h(primaryMeeting.startTime)} in ${primaryMeeting.location}.`,
      },
      {
        id: `${wfId}_s2`,
        order: 2,
        title: 'Check Schedule Conflicts',
        description: 'Scan surrounding calendar blocks for overlaps and travel/focus buffer.',
        toolName: 'Planner.ConflictAnalyzer',
        riskLevel: 'Low',
        requiresApproval: false,
        status: 'Pending',
        outputNote: overlapping
          ? `Detected overlap with "${overlapping.title}" (${formatTime12h(overlapping.startTime)}).`
          : 'No overlapping calendar blocks detected; 45m prep buffer available.',
      },
      {
        id: `${wfId}_s3`,
        order: 3,
        title: 'Find Related Documents',
        description: 'Retrieve latest decks, spreadsheets, and notes from Google Drive.',
        toolName: 'GoogleDrive.SearchFiles',
        riskLevel: 'Low',
        requiresApproval: false,
        status: 'Pending',
        outputNote: matchedDocs
          ? `Attached ${matchedDocs} to your Meeting Prep brief.`
          : 'Indexed workspace notes for meeting brief.',
      },
      {
        id: `${wfId}_s4`,
        order: 4,
        title: 'Create Two-Hour Reminder',
        description: `Schedule local + push reminder for ${formatTime12h(reminderTime)} on ${primaryMeeting.date}.`,
        toolName: 'Reminders.CreateTrigger',
        riskLevel: 'Medium',
        requiresApproval: false,
        status: 'Pending',
        outputNote: `Reminder armed for ${formatTime12h(reminderTime)} (${primaryMeeting.date}).`,
      },
      {
        id: `${wfId}_s5`,
        order: 5,
        title: overlapping
          ? 'Propose Schedule Update & Notify Attendees'
          : 'Share Preparation Brief & Lock Calendar Buffer',
        description: overlapping
          ? `Send reschedule proposal email for "${overlapping.title}" to clear the ${formatTime12h(primaryMeeting.startTime)} slot.`
          : `Update Google Calendar event notes and send pre-read summary email to ${primaryMeeting.attendees.join(', ')}.`,
        toolName: 'Gmail.SendMessage + GoogleCalendar.PatchEvent',
        riskLevel: 'High',
        requiresApproval: true,
        status: 'Pending',
        actionSummary: overlapping
          ? `Move "${overlapping.title}" to 2:00 PM on ${primaryMeeting.date} and email attendees`
          : `Send pre-read links (${matchedDocs || 'Agenda'}) to ${primaryMeeting.attendees.join(', ')}`,
      },
      {
        id: `${wfId}_s6`,
        order: 6,
        title: 'Prepare Meeting Checklist',
        description: 'Finalize talking points, open action items, and follow-up tracker.',
        toolName: 'LifePilot.ChecklistBuilder',
        riskLevel: 'Low',
        requiresApproval: false,
        status: 'Pending',
        outputNote: 'Meeting preparation checklist saved and linked to Tasks.',
      },
    ];

    const workflow = advanceWorkflowExecution(
      {
        id: wfId,
        title: `Prepare: ${primaryMeeting.title}`,
        userGoal: userPrompt,
        understoodIntent: `Locate "${primaryMeeting.title}" on ${primaryMeeting.date}, gather Drive documents, set a ${formatTime12h(reminderTime)} reminder, resolve schedule conflicts, and build a preparation checklist.`,
        status: 'Active',
        createdAt: nowIso,
        updatedAt: nowIso,
        steps: rawSteps,
        relatedEventId: primaryMeeting.id,
      },
      nowIso,
    );

    return {
      understoodIntent: workflow.understoodIntent,
      assistantReply: `I found "${primaryMeeting.title}" at ${formatTime12h(primaryMeeting.startTime)} (${primaryMeeting.date}), pulled your related Drive files, and set a reminder for ${formatTime12h(reminderTime)}. Step 5 touches external calendar/email data, so it is paused waiting for your approval.`,
      workflow,
      suggestedReminder: {
        title: `Prep check: ${primaryMeeting.title} (2h prior)`,
        date: primaryMeeting.date,
        time: reminderTime,
        category: 'Meeting',
      },
      suggestedTask: {
        title: `Review pre-read deck for ${primaryMeeting.title}`,
        description: `Verify key metrics and talking points in ${matchedDocs || 'meeting notes'} before ${formatTime12h(primaryMeeting.startTime)}.`,
        priority: 'High',
        dueDate: primaryMeeting.date,
        estimatedMinutes: 35,
        bestTimeWindow: 'Today · 1:30 PM – 2:15 PM',
        tags: ['Meeting Prep', 'Priority'],
      },
    };
  }

  if (isReminderOnly) {
    const targetDate = lower.includes('tomorrow') ? tomorrowKey : ctx.todayKey;
    const is8pm = lower.includes('8 pm') || lower.includes('8:00 pm') || lower.includes('20:00');
    const time = is8pm ? '20:00' : '18:00';
    const cleanTitle = userPrompt
      .replace(/^remind me to\s+/i, '')
      .replace(/\s+tomorrow.*$/i, '')
      .trim();
    const reminderTitle =
      cleanTitle.length > 3
        ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1)
        : 'Follow-up reminder';

    const workflow = advanceWorkflowExecution(
      {
        id: wfId,
        title: `Reminder: ${reminderTitle}`,
        userGoal: userPrompt,
        understoodIntent: `Create a smart deadline reminder "${reminderTitle}" for ${targetDate} at ${formatTime12h(time)}.`,
        status: 'Active',
        createdAt: nowIso,
        updatedAt: nowIso,
        steps: [
          {
            id: `${wfId}_s1`,
            order: 1,
            title: 'Parse Schedule & Deadline',
            description: `Extract target date (${targetDate}) and local notification time (${formatTime12h(time)}).`,
            toolName: 'Agent.TemporalParser',
            riskLevel: 'Low',
            requiresApproval: false,
            status: 'Pending',
          },
          {
            id: `${wfId}_s2`,
            order: 2,
            title: 'Schedule Smart Reminder',
            description: `Register "${reminderTitle}" with local WorkManager & push trigger.`,
            toolName: 'Reminders.CreateTrigger',
            riskLevel: 'Medium',
            requiresApproval: false,
            status: 'Pending',
            outputNote: `Scheduled for ${targetDate} at ${formatTime12h(time)}.`,
          },
        ],
      },
      nowIso,
    );

    return {
      understoodIntent: workflow.understoodIntent,
      assistantReply: `Done — I scheduled a reminder to "${reminderTitle}" for ${targetDate === tomorrowKey ? 'tomorrow' : 'today'} at ${formatTime12h(time)} and synced it to your Reminders list.`,
      workflow,
      suggestedReminder: {
        title: reminderTitle,
        date: targetDate,
        time,
        category: 'Deadline',
      },
    };
  }

  // General daily organization / task workflow
  const openTasks = ctx.tasks.filter((t) => t.status !== 'Completed');
  const topTask = openTasks[0];
  const workflow = advanceWorkflowExecution(
    {
      id: wfId,
      title: 'Organize Daily Priorities & Focus Plan',
      userGoal: userPrompt,
      understoodIntent: `Analyze ${openTasks.length} open tasks against today's calendar availability, sequence focus blocks, and queue external calendar holds for approval.`,
      status: 'Active',
      createdAt: nowIso,
      updatedAt: nowIso,
      steps: [
        {
          id: `${wfId}_s1`,
          order: 1,
          title: 'Audit Open Tasks & Deadlines',
          description: `Evaluate ${openTasks.length} active tasks by urgency, effort, and deadline proximity.`,
          toolName: 'Tasks.PriorityAnalyzer',
          riskLevel: 'Low',
          requiresApproval: false,
          status: 'Pending',
          outputNote: topTask
            ? `Ranked "${topTask.title}" #1 (${topTask.priority} priority, ${topTask.estimatedMinutes}m).`
            : 'Reviewed current task backlog.',
        },
        {
          id: `${wfId}_s2`,
          order: 2,
          title: 'Map Free Calendar Focus Windows',
          description: 'Identify uninterrupted 60–90 minute blocks around existing meetings.',
          toolName: 'GoogleCalendar.FreeBusy',
          riskLevel: 'Low',
          requiresApproval: false,
          status: 'Pending',
          outputNote: 'Found open focus windows at 9:00 AM – 11:00 AM and 1:00 PM – 2:45 PM.',
        },
        {
          id: `${wfId}_s3`,
          order: 3,
          title: 'Generate Time-Blocked Daily Plan',
          description: 'Slot priority deliverables before afternoon meetings.',
          toolName: 'Planner.DailyOptimizer',
          riskLevel: 'Low',
          requiresApproval: false,
          status: 'Pending',
          outputNote: 'Updated Daily Plan with prioritized focus blocks.',
        },
        {
          id: `${wfId}_s4`,
          order: 4,
          title: 'Publish Focus Hold to Google Calendar',
          description: 'Write "Deep Work — Do Not Book" event to shared Google Calendar.',
          toolName: 'GoogleCalendar.CreateEvent',
          riskLevel: 'High',
          requiresApproval: true,
          status: 'Pending',
          actionSummary: `Create shared calendar block "Deep Work: ${topTask?.title || 'Priority Deliverable'}" (1:00 PM – 2:30 PM)`,
        },
      ],
    },
    nowIso,
  );

  return {
    understoodIntent: workflow.understoodIntent,
    assistantReply: `I organized your ${openTasks.length} open tasks around today's meetings and refreshed your Daily Plan. Approve Step 4 if you want me to publish the focus block to your shared Google Calendar.`,
    workflow,
  };
}
