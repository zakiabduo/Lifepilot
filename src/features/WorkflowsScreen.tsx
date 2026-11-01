import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellPlus,
  CheckSquare,
  FileText,
  Square,
  Users,
} from 'lucide-react';
import type { MeetingChecklistItem, WorkflowStatus, WorkspaceState } from '../domain/types';
import { toLocalDateKey } from '../domain/dateUtils';
import { buildMeetingPreparation } from '../domain/plannerEngine';
import { Button, SelectField, Surface } from '../components/ui';
import { WorkflowVisualizer } from '../components/WorkflowVisualizer';

export function WorkflowsScreen({
  state,
  busy,
  selectedWorkflowId,
  initialSubView = 'workflows',
  selectedEventId,
  onSelectWorkflow,
  onSelectEvent,
  onSubViewChange,
  onApproveStep,
  onRejectStep,
  onWorkflowAction,
  onSaveChecklist,
  onCreateMeetingReminder,
}: {
  state: WorkspaceState;
  busy: boolean;
  selectedWorkflowId: string | null;
  initialSubView?: 'workflows' | 'meeting-prep';
  selectedEventId: string | null;
  onSelectWorkflow: (id: string) => void;
  onSelectEvent: (id: string) => void;
  onSubViewChange: (view: 'workflows' | 'meeting-prep') => void;
  onApproveStep: (workflowId: string, stepId: string, editedSummary?: string) => void;
  onRejectStep: (workflowId: string, stepId: string, reason?: string) => void;
  onWorkflowAction: (
    workflowId: string,
    action: 'pause' | 'resume' | 'cancel' | 'retry',
    stepId?: string,
  ) => void;
  onSaveChecklist: (eventId: string, items: MeetingChecklistItem[]) => void;
  onCreateMeetingReminder: (eventTitle: string, date: string, startTime: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'All' | WorkflowStatus>('All');
  const todayKey = toLocalDateKey(new Date());

  const filteredWorkflows = useMemo(() => {
    if (statusFilter === 'All') return state.workflows;
    return state.workflows.filter((w) => w.status === statusFilter);
  }, [state.workflows, statusFilter]);

  const activeWorkflow =
    filteredWorkflows.find((w) => w.id === selectedWorkflowId) ||
    filteredWorkflows[0] ||
    state.workflows[0];

  const activeEvent =
    state.events.find((e) => e.id === selectedEventId) ||
    state.events.find((e) => e.id === 'evt_q4_arch') ||
    state.events[0];

  const meetingBrief = useMemo(() => {
    if (!activeEvent) return null;
    const hasReminder = state.reminders.some(
      (r) =>
        !r.completed &&
        (r.date === activeEvent.date ||
          r.title.toLowerCase().includes(activeEvent.title.slice(0, 10).toLowerCase())),
    );
    return buildMeetingPreparation(
      activeEvent,
      state.documents,
      state.tasks,
      state.events,
      state.meetingChecklists[activeEvent.id],
      hasReminder,
      todayKey,
    );
  }, [
    activeEvent,
    state.documents,
    state.tasks,
    state.events,
    state.meetingChecklists,
    state.reminders,
    todayKey,
  ]);

  const toggleChecklistItem = (itemId: string) => {
    if (!meetingBrief) return;
    const updated = meetingBrief.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    );
    onSaveChecklist(meetingBrief.eventId, updated);
  };

  return (
    <div className="space-y-6">
      {/* Mode switch: Workflows vs Meeting Preparation Agent */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Workflow views" className="flex flex-wrap items-center gap-2">
          <Button
            role="tab"
            aria-selected={initialSubView === 'workflows'}
            tone={initialSubView === 'workflows' ? 'primary' : 'quiet'}
            onClick={() => onSubViewChange('workflows')}
          >
            Agent workflows ({state.workflows.length})
          </Button>
          <Button
            role="tab"
            aria-selected={initialSubView === 'meeting-prep'}
            tone={initialSubView === 'meeting-prep' ? 'primary' : 'quiet'}
            onClick={() => onSubViewChange('meeting-prep')}
          >
            Meeting preparation
          </Button>
        </div>

        {initialSubView === 'workflows' ? (
          <div className="flex flex-wrap items-center gap-2">
            {(['All', 'Waiting for Approval', 'Active', 'Completed'] as const).map((filter) => (
              <Button
                key={filter}
                tone={statusFilter === filter ? 'primary' : 'quiet'}
                className="px-3"
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'Waiting for Approval' ? 'Needs approval' : filter}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {initialSubView === 'workflows' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Workflow Selector List */}
          <div className="lg:col-span-5">
            <Surface className="divide-y divide-border/60">
              <div className="px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">Workflows</h2>
                <p className="text-xs text-muted">
                  Persistent multi-step runs — leave and return anytime.
                </p>
              </div>

              {filteredWorkflows.length === 0 ? (
                <div className="p-5 text-sm text-muted">
                  No workflows match "{statusFilter}". Choose "All" or ask LifePilot to start a new goal.
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {filteredWorkflows.map((wf) => {
                    const isSelected = activeWorkflow?.id === wf.id;
                    const doneSteps = wf.steps.filter((s) => s.status === 'Completed').length;
                    return (
                      <li key={wf.id}>
                        <button
                          type="button"
                          onClick={() => onSelectWorkflow(wf.id)}
                          aria-current={isSelected ? 'true' : undefined}
                          className={`w-full px-5 py-4 text-left transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-primary ${
                            isSelected ? 'bg-background' : ''
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {wf.title}
                            </span>
                            <span
                              className={`shrink-0 text-xs tabular-nums ${
                                wf.status === 'Waiting for Approval'
                                  ? 'font-semibold text-warning'
                                  : wf.status === 'Completed'
                                    ? 'font-medium text-success'
                                    : wf.status === 'Failed'
                                      ? 'font-semibold text-danger'
                                      : 'text-muted'
                              }`}
                            >
                              {wf.status}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted">{wf.userGoal}</p>
                          <p className="mt-1.5 text-xs text-muted tabular-nums">
                            {doneSteps}/{wf.steps.length} steps completed
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Surface>
          </div>

          {/* Selected Workflow Visual Diagram & Approval Controls */}
          <div className="lg:col-span-7">
            {activeWorkflow ? (
              <WorkflowVisualizer
                workflow={activeWorkflow}
                busy={busy}
                onApproveStep={onApproveStep}
                onRejectStep={onRejectStep}
                onWorkflowAction={onWorkflowAction}
              />
            ) : null}
          </div>
        </div>
      ) : meetingBrief && activeEvent ? (
        <div className="space-y-6">
          <Surface className="divide-y divide-border/60">
            <div className="flex flex-wrap items-end justify-between gap-4 p-5">
              <div className="w-full max-w-md">
                <SelectField
                  id="meeting-prep-selector"
                  label="Select upcoming calendar meeting"
                  value={activeEvent.id}
                  onChange={(e) => onSelectEvent(e.target.value)}
                >
                  {state.events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.date} · {ev.startTime})
                    </option>
                  ))}
                </SelectField>
              </div>

              <Button
                tone={meetingBrief.reminderSet ? 'quiet' : 'primary'}
                disabled={busy}
                onClick={() =>
                  onCreateMeetingReminder(
                    activeEvent.title,
                    activeEvent.date,
                    activeEvent.startTime,
                  )
                }
              >
                <BellPlus className="h-4 w-4" aria-hidden="true" />
                {meetingBrief.reminderSet ? 'Add extra reminder' : 'Remind me 2h before'}
              </Button>
            </div>

            <div className="space-y-3 p-5">
              <h2 className="text-xl font-semibold text-foreground">{meetingBrief.eventTitle}</h2>
              <p className="text-sm text-muted tabular-nums">
                {meetingBrief.dateLabel} · {meetingBrief.timeRange} · {meetingBrief.location}
              </p>
              <p className="flex items-center gap-2 text-sm text-muted">
                <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>Attendees: {meetingBrief.attendees.join(', ')}</span>
              </p>
              <p className="max-w-[70ch] text-sm leading-relaxed text-foreground">
                {meetingBrief.summary}
              </p>

              {meetingBrief.conflictNote ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-warning">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{meetingBrief.conflictNote}</span>
                  </p>
                  <Button tone="quiet" onClick={() => onSubViewChange('workflows')}>
                    Resolve in workflow
                  </Button>
                </div>
              ) : null}
            </div>
          </Surface>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Preparation Checklist */}
            <div className="lg:col-span-6">
              <Surface className="divide-y divide-border/60">
                <div className="px-5 py-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Preparation checklist
                  </h3>
                  <p className="text-xs text-muted">
                    Generated from your meeting agenda, emails, and open deliverables.
                  </p>
                </div>

                <ul className="divide-y divide-border/50">
                  {meetingBrief.checklist.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => toggleChecklistItem(item.id)}
                        className="flex min-h-12 w-full items-center gap-3 px-5 py-3 text-left hover:bg-background focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {item.done ? (
                          <CheckSquare
                            className="h-5 w-5 shrink-0 text-success"
                            aria-hidden="true"
                          />
                        ) : (
                          <Square className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                        )}
                        <span
                          className={`text-sm ${
                            item.done ? 'text-muted line-through' : 'text-foreground'
                          }`}
                        >
                          {item.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Surface>
            </div>

            {/* Matched Documents & Related Tasks */}
            <div className="space-y-6 lg:col-span-6">
              <Surface className="divide-y divide-border/60">
                <div className="px-5 py-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Relevant documents & threads
                  </h3>
                  <p className="text-xs text-muted">Indexed from Google Drive and Gmail</p>
                </div>
                <ul className="divide-y divide-border/50">
                  {meetingBrief.documents.map((doc) => (
                    <li key={doc.id} className="space-y-1 px-5 py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          <span>{doc.title}</span>
                        </p>
                        <span className="shrink-0 text-xs text-muted">{doc.source}</span>
                      </div>
                      <p className="text-xs text-muted">{doc.summary}</p>
                      <p className="text-xs text-muted">{doc.updatedLabel}</p>
                    </li>
                  ))}
                </ul>
              </Surface>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
