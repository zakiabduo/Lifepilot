import React, { useState } from 'react';
import { ArrowRight, Loader2, Mic, MicOff, Send } from 'lucide-react';
import type { WorkspaceState } from '../domain/types';
import { AGENT_PIPELINE_STAGES } from '../domain/workflowEngine';
import { Button, Surface } from '../components/ui';
import { WorkflowVisualizer } from '../components/WorkflowVisualizer';

const SUGGESTED_COMMANDS = [
  {
    label: 'Prepare me for a meeting',
    prompt:
      'I have a meeting tomorrow. Prepare my documents, remind me two hours before, and organize my schedule.',
  },
  {
    label: 'Plan my day',
    prompt: 'Organize my priority tasks and free calendar windows into a focused plan for today.',
  },
  {
    label: 'What should I do next?',
    prompt: 'What should I do next?',
  },
  {
    label: 'Remind me at 8 PM',
    prompt: 'Remind me to submit my assignment tomorrow at 8 PM.',
  },
  {
    label: 'Check my deadlines',
    prompt: 'Check my upcoming deadlines and create a focus workflow for today.',
  },
];

export function AssistantScreen({
  state,
  busy,
  onSendPrompt,
  onApproveStep,
  onRejectStep,
  onOpenWorkflowInTab,
}: {
  state: WorkspaceState;
  busy: boolean;
  onSendPrompt: (prompt: string) => Promise<void>;
  onApproveStep: (workflowId: string, stepId: string, editedSummary?: string) => void;
  onRejectStep: (workflowId: string, stepId: string, reason?: string) => void;
  onOpenWorkflowInTab: (workflowId: string) => void;
}) {
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    setInput('');
    setVoiceFeedback(null);
    await onSendPrompt(trimmed);
  };

  const handleVoiceToggle = () => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      // Populate natural voice phrase gracefully when browser speech engine isn't present
      const dictated =
        'I have a meeting tomorrow. Prepare my documents, remind me two hours before, and organize my schedule.';
      setInput(dictated);
      setVoiceFeedback('Voice sample loaded into composer — press Send or edit first.');
      return;
    }

    if (listening) {
      setListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      setListening(true);
      setVoiceFeedback('Listening… speak your goal clearly.');
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setListening(false);
        setVoiceFeedback(null);
      };
      recognition.onerror = () => {
        setListening(false);
        setVoiceFeedback('Microphone unavailable in this browser context — type or pick a suggestion below.');
      };
      recognition.onend = () => {
        setListening(false);
      };
      recognition.start();
    } catch {
      setListening(false);
      setVoiceFeedback('Voice input unavailable — type your command below.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Suggested Commands & Agent Status */}
      <Surface className="divide-y divide-border/60">
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Talk to your LifePilot agent
              </h2>
              <p className="text-sm text-muted">
                Describe a goal in plain language. LifePilot creates a transparent workflow and asks before taking high-risk actions.
              </p>
            </div>
            <span className="text-xs font-medium text-primary">
              {busy ? 'Planning & verifying workflow…' : 'Ready · Human approval active'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {SUGGESTED_COMMANDS.map((cmd) => (
              <Button
                key={cmd.label}
                tone="quiet"
                disabled={busy}
                onClick={() => onSendPrompt(cmd.prompt)}
              >
                {cmd.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Live Agent Pipeline Indicator when busy */}
        {busy ? (
          <div role="status" className="flex items-center gap-3 px-5 py-3.5 text-sm text-primary">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            <span>
              Running pipeline: {AGENT_PIPELINE_STAGES.join(' → ')}
            </span>
          </div>
        ) : null}

        {/* Natural Language Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <label htmlFor="assistant-goal-input" className="block text-sm font-medium text-foreground">
            Your goal or instruction
          </label>
          <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
            <input
              id="assistant-goal-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Try: "I have a meeting tomorrow. Prepare my documents and remind me 2h before."'
              className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-3.5 text-base text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
            <div className="flex items-center gap-2">
              <Button
                tone="quiet"
                onClick={handleVoiceToggle}
                aria-label={listening ? 'Stop voice input' : 'Use voice input'}
              >
                {listening ? (
                  <MicOff className="h-4 w-4 text-danger" aria-hidden="true" />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden="true" />
                )}
                Voice
              </Button>
              <Button type="submit" disabled={busy || !input.trim()}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send goal
              </Button>
            </div>
          </div>
          {voiceFeedback ? (
            <p role="status" className="text-xs text-muted">
              {voiceFeedback}
            </p>
          ) : null}
        </form>
      </Surface>

      {/* Conversation History & Inline Workflow Previews */}
      <div className="space-y-4" aria-label="Conversation history">
        {state.messages
          .slice()
          .reverse()
          .map((msg) => {
            const linkedWorkflow = msg.workflowId
              ? state.workflows.find((w) => w.id === msg.workflowId)
              : undefined;

            return (
              <div key={msg.id} className="space-y-3">
                <Surface className="divide-y divide-border/50">
                  <div className="space-y-2 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {msg.role === 'user' ? state.user.name : 'LifePilot AI'}
                      </span>
                      <span className="text-xs text-muted tabular-nums">{msg.createdAt}</span>
                    </div>

                    <p className="max-w-[72ch] text-base leading-relaxed text-foreground">
                      {msg.content}
                    </p>

                    {msg.understoodIntent ? (
                      <p className="pt-1 text-xs text-muted">
                        <span className="font-medium text-foreground">Parsed intent: </span>
                        {msg.understoodIntent}
                      </p>
                    ) : null}

                    {msg.agentStages && msg.agentStages.length > 0 ? (
                      <p className="text-xs text-primary">
                        {msg.agentStages.join(' · ')}
                      </p>
                    ) : null}

                    {linkedWorkflow ? (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenWorkflowInTab(linkedWorkflow.id)}
                          className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          Open full workflow details
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </Surface>

                {linkedWorkflow ? (
                  <WorkflowVisualizer
                    workflow={linkedWorkflow}
                    compact
                    busy={busy}
                    onApproveStep={onApproveStep}
                    onRejectStep={onRejectStep}
                  />
                ) : null}
              </div>
            );
          })}
      </div>
    </div>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}
