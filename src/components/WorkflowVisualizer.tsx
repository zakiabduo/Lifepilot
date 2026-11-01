import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { RiskLevel, StepStatus, Workflow, WorkflowStep } from '../domain/types';
import { Button, Field, Surface } from './ui';

function StepStatusGlyph({ status }: { status: StepStatus }) {
  switch (status) {
    case 'Completed':
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />;
    case 'Running':
    case 'Planning':
      return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />;
    case 'Waiting for Approval':
      return <ShieldAlert className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />;
    case 'Failed':
      return <AlertTriangle className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />;
    case 'Pending':
    default:
      return <Clock className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />;
  }
}

function statusColorClass(status: StepStatus): string {
  switch (status) {
    case 'Completed':
      return 'text-success font-medium';
    case 'Waiting for Approval':
      return 'text-warning font-semibold';
    case 'Failed':
      return 'text-danger font-semibold';
    case 'Running':
    case 'Planning':
      return 'text-primary font-medium';
    default:
      return 'text-muted';
  }
}

function riskColorClass(risk: RiskLevel): string {
  if (risk === 'High') return 'text-danger font-medium';
  if (risk === 'Medium') return 'text-warning font-medium';
  return 'text-muted';
}

export function WorkflowVisualizer({
  workflow,
  compact = false,
  busy = false,
  onApproveStep,
  onRejectStep,
  onWorkflowAction,
}: {
  workflow: Workflow;
  compact?: boolean;
  busy?: boolean;
  onApproveStep: (workflowId: string, stepId: string, editedSummary?: string) => void;
  onRejectStep: (workflowId: string, stepId: string, reason?: string) => void;
  onWorkflowAction?: (
    workflowId: string,
    action: 'pause' | 'resume' | 'cancel' | 'retry',
    stepId?: string,
  ) => void;
}) {
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState('');

  const completedCount = workflow.steps.filter((s) => s.status === 'Completed').length;

  const startEdit = (step: WorkflowStep) => {
    setEditingStepId(step.id);
    setEditedSummary(step.actionSummary || step.description);
  };

  return (
    <Surface className="divide-y divide-border/60">
      {/* Header & Intent Summary */}
      <div className="space-y-2 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-lg font-semibold text-foreground">{workflow.title}</h3>
            <p className="text-xs text-muted tabular-nums">
              <span
                className={
                  workflow.status === 'Waiting for Approval'
                    ? 'font-semibold text-warning'
                    : workflow.status === 'Completed'
                      ? 'font-medium text-success'
                      : workflow.status === 'Failed'
                        ? 'font-semibold text-danger'
                        : 'font-medium text-foreground'
                }
              >
                {workflow.status}
              </span>
              {' · '}
              {completedCount} of {workflow.steps.length} steps completed
            </p>
          </div>

          {!compact && onWorkflowAction && workflow.status !== 'Completed' && workflow.status !== 'Cancelled' ? (
            <div className="flex flex-wrap items-center gap-2">
              {workflow.status === 'Paused' ? (
                <Button
                  tone="quiet"
                  disabled={busy}
                  onClick={() => onWorkflowAction(workflow.id, 'resume')}
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Resume
                </Button>
              ) : (
                <Button
                  tone="quiet"
                  disabled={busy}
                  onClick={() => onWorkflowAction(workflow.id, 'pause')}
                >
                  <Pause className="h-4 w-4" aria-hidden="true" />
                  Pause
                </Button>
              )}
              <Button
                tone="quiet"
                disabled={busy}
                onClick={() => onWorkflowAction(workflow.id, 'cancel')}
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          ) : null}
        </div>

        <p className="text-sm leading-relaxed text-muted">
          <span className="font-medium text-foreground">AI understood: </span>
          {workflow.understoodIntent}
        </p>
      </div>

      {/* Visual Step Pipeline */}
      <div className="p-5">
        <ol className="space-y-0" aria-label={`Steps for ${workflow.title}`}>
          {workflow.steps.map((step, idx) => {
            const isLast = idx === workflow.steps.length - 1;
            const isWaiting = step.status === 'Waiting for Approval';
            const isFailed = step.status === 'Failed';
            const isEditingThis = editingStepId === step.id;

            return (
              <li key={step.id} className="flex gap-3.5">
                {/* Vertical connector rail + status icon */}
                <div className="flex flex-col items-center">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center">
                    <StepStatusGlyph status={step.status} />
                  </div>
                  {!isLast ? (
                    <div
                      className={`my-1 w-px flex-1 ${
                        step.status === 'Completed' ? 'bg-success/50' : 'bg-border'
                      }`}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>

                {/* Step body */}
                <div className={`min-w-0 flex-1 ${isLast ? 'pb-1' : 'pb-5'}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {step.order}. {step.title}
                    </p>
                    <p className="text-xs tabular-nums">
                      <span className={statusColorClass(step.status)}>{step.status}</span>
                      {' · '}
                      <span className={riskColorClass(step.riskLevel)}>
                        {step.riskLevel} risk
                      </span>
                    </p>
                  </div>

                  <p className="mt-1 text-sm text-muted">{step.description}</p>

                  <p className="mt-1 font-mono text-xs text-muted">Tool: {step.toolName}</p>

                  {step.outputNote && step.status === 'Completed' ? (
                    <p className="mt-1.5 text-xs text-foreground">
                      Outcome: {step.outputNote}
                    </p>
                  ) : null}

                  {isFailed ? (
                    <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                      <p className="text-xs text-danger">
                        Failed: {step.errorReason || 'Temporary integration error.'}{' '}
                        {step.recoveryHint || 'Check connection and retry step.'}
                      </p>
                      {onWorkflowAction ? (
                        <Button
                          tone="quiet"
                          disabled={busy}
                          onClick={() => onWorkflowAction(workflow.id, 'retry', step.id)}
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          Retry step
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {isWaiting ? (
                    <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-warning">
                          LifePilot AI needs your approval ({step.riskLevel} risk)
                        </p>
                        <p className="text-sm text-foreground">
                          Proposed action: {step.actionSummary || step.description}
                        </p>
                      </div>

                      {isEditingThis ? (
                        <div className="space-y-2.5">
                          <Field
                            id={`edit_step_${step.id}`}
                            label="Edit action details before approving"
                            value={editedSummary}
                            onChange={(e) => setEditedSummary(e.target.value)}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              disabled={busy || !editedSummary.trim()}
                              onClick={() => {
                                onApproveStep(workflow.id, step.id, editedSummary.trim());
                                setEditingStepId(null);
                              }}
                            >
                              Save & approve
                            </Button>
                            <Button tone="quiet" onClick={() => setEditingStepId(null)}>
                              Cancel edit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            disabled={busy}
                            aria-label={`Approve ${step.title}`}
                            onClick={() => onApproveStep(workflow.id, step.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            tone="quiet"
                            disabled={busy}
                            aria-label={`Edit ${step.title}`}
                            onClick={() => startEdit(step)}
                          >
                            <Edit3 className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            tone="quiet"
                            disabled={busy}
                            aria-label={`Reject ${step.title}`}
                            onClick={() =>
                              onRejectStep(workflow.id, step.id, 'Declined by user')
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Surface>
  );
}
