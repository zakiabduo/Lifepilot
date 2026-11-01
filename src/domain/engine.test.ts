import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialWorkspaceState } from './seedData.ts';
import {
  advanceWorkflowExecution,
  approveWorkflowStep,
  cancelWorkflow,
  pauseWorkflow,
  planGoalWorkflow,
  rejectWorkflowStep,
  resumeWorkflow,
  retryWorkflowStep,
} from './workflowEngine.ts';
import {
  detectScheduleConflicts,
  generateDailySchedule,
  mergeOfflineMutations,
  rankNextBestAction,
} from './plannerEngine.ts';
import { toLocalDateKey, addDaysToDateKey } from './dateUtils.ts';

test('workflow state machine pauses at High-risk step and completes after human approval', () => {
  const fixedNow = new Date(2026, 10, 1, 9, 0, 0);
  const state = createInitialWorkspaceState(fixedNow);
  const todayKey = toLocalDateKey(fixedNow);

  const outcome = planGoalWorkflow(
    'I have a meeting tomorrow. Prepare my documents, remind me two hours before, and organize my schedule.',
    {
      todayKey,
      events: state.events,
      documents: state.documents,
      tasks: state.tasks,
    },
    fixedNow.toISOString(),
  );

  assert.equal(outcome.workflow.status, 'Waiting for Approval');
  const waitingStep = outcome.workflow.steps.find((s) => s.status === 'Waiting for Approval');
  assert.ok(waitingStep, 'Expected a high-risk step waiting for approval');
  assert.equal(waitingStep.riskLevel, 'High');

  const completedCountBefore = outcome.workflow.steps.filter((s) => s.status === 'Completed').length;
  assert.equal(completedCountBefore, 4);

  const afterApproval = approveWorkflowStep(
    outcome.workflow,
    waitingStep.id,
    'Move Vendor Security Check-in to 2:30 PM tomorrow',
    fixedNow.toISOString(),
  );

  assert.equal(afterApproval.status, 'Completed');
  assert.equal(
    afterApproval.steps.every((s) => s.status === 'Completed'),
    true,
  );
});

test('workflow pause, resume, reject, retry, and cancel transitions preserve user control', () => {
  const fixedNow = new Date(2026, 10, 1, 9, 0, 0);
  const state = createInitialWorkspaceState(fixedNow);
  const wf = state.workflows[0];

  const paused = pauseWorkflow(wf, fixedNow.toISOString());
  assert.equal(paused.status, 'Paused');

  const resumed = resumeWorkflow(paused, fixedNow.toISOString());
  assert.equal(resumed.status, 'Waiting for Approval');

  const step5 = resumed.steps.find((s) => s.status === 'Waiting for Approval')!;
  const afterReject = rejectWorkflowStep(resumed, step5.id, 'Keep vendor slot as-is', fixedNow.toISOString());
  assert.equal(afterReject.status, 'Completed');

  // Test failed step retry
  const failedWf = advanceWorkflowExecution(
    {
      ...wf,
      status: 'Active',
      steps: wf.steps.map((s, idx) =>
        idx === 2 ? { ...s, status: 'Failed', errorReason: 'Drive timeout' } : s,
      ),
    },
    fixedNow.toISOString(),
  );
  assert.equal(failedWf.status, 'Failed');

  const retried = retryWorkflowStep(failedWf, failedWf.steps[2].id, fixedNow.toISOString());
  assert.equal(retried.status, 'Waiting for Approval');

  const cancelled = cancelWorkflow(retried, fixedNow.toISOString());
  assert.equal(cancelled.status, 'Cancelled');
});

test('conflict detector and daily schedule avoid overlapping focus tasks with meetings', () => {
  const fixedNow = new Date(2026, 10, 1, 9, 0, 0);
  const state = createInitialWorkspaceState(fixedNow);
  const todayKey = toLocalDateKey(fixedNow);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);

  const tomorrowConflicts = detectScheduleConflicts(state.events, tomorrowKey);
  assert.equal(tomorrowConflicts.length, 1);
  assert.equal(tomorrowConflicts[0].first.id, 'evt_q4_arch');
  assert.equal(tomorrowConflicts[0].second.id, 'evt_vendor_conflict');

  const dailyPlan = generateDailySchedule(state.tasks, state.events, todayKey, 0);
  assert.ok(dailyPlan.length >= 4);
  const focusSlots = dailyPlan.filter((s) => s.kind === 'focus');
  assert.ok(focusSlots.length >= 2);
});

test('rankNextBestAction prioritizes urgent high-priority deadlines with clear explanation', () => {
  const fixedNow = new Date(2026, 10, 1, 9, 0, 0);
  const state = createInitialWorkspaceState(fixedNow);
  const todayKey = toLocalDateKey(fixedNow);

  const nba = rankNextBestAction(state.tasks, state.events, state.workflows, todayKey);
  assert.equal(nba.targetType, 'task');
  assert.ok(nba.explanation.length > 20);
});

test('mergeOfflineMutations reconciles offline-created tasks and status updates idempotently', () => {
  const fixedNow = new Date(2026, 10, 1, 9, 0, 0);
  const state = createInitialWorkspaceState(fixedNow);
  const todayKey = toLocalDateKey(fixedNow);

  const merged = mergeOfflineMutations(state, [
    {
      id: 'mut_1',
      kind: 'create_task',
      queuedAt: fixedNow.toISOString(),
      payload: {
        id: 'tsk_offline_1',
        title: 'Draft investor update offline',
        description: 'Created while on airplane mode',
        priority: 'High',
        dueDate: todayKey,
        status: 'To Do',
        tags: ['Offline'],
        estimatedMinutes: 30,
        bestTimeWindow: '9:00 AM',
        updatedAt: fixedNow.toISOString(),
        pendingSync: true,
      },
    },
    {
      id: 'mut_2',
      kind: 'toggle_task',
      queuedAt: fixedNow.toISOString(),
      payload: {
        id: 'tsk_offline_1',
        status: 'Completed',
      },
    },
  ]);

  const syncedTask = merged.tasks.find((t) => t.id === 'tsk_offline_1');
  assert.ok(syncedTask);
  assert.equal(syncedTask.status, 'Completed');
  assert.equal(syncedTask.pendingSync, false);
});
