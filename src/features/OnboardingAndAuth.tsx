import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Link2,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import type { IntegrationConnector, UserProfile } from '../domain/types';
import { Button, Field, Surface } from '../components/ui';

const ONBOARDING_STEPS = [
  {
    step: 1,
    title: 'Your personal AI life manager',
    body: 'LifePilot AI brings your tasks, calendar schedules, smart reminders, and daily priorities together in one calm, organized workspace.',
    highlights: [
      'Morning briefing tailored to your real calendar and deadlines',
      'Offline-ready tasks and reminders that sync automatically',
      'Designed for clarity — zero technical setup required',
    ],
    icon: Sparkles,
  },
  {
    step: 2,
    title: 'Turn goals into actions',
    body: 'State a complex goal in one sentence — such as preparing for tomorrow’s meeting — and LifePilot breaks it into a transparent, trackable workflow.',
    highlights: [
      'Checks connected calendar events and schedule conflicts',
      'Finds related documents in Google Drive and Gmail',
      'Builds checklists and schedules two-hour reminders',
    ],
    icon: Workflow,
  },
  {
    step: 3,
    title: 'You stay in control',
    body: 'LifePilot never sends external emails or modifies shared invites behind your back. High-risk actions pause and wait for your explicit approval.',
    highlights: [
      'Clear Low, Medium, and High risk labels on every step',
      'Approve, edit details, or reject any sensitive action',
      'Pause, resume, or cancel workflows at any time',
    ],
    icon: ShieldCheck,
  },
  {
    step: 4,
    title: 'Connect your tools',
    body: 'Choose which services LifePilot can read and coordinate on your behalf. You can disconnect or adjust permissions anytime in Profile.',
    highlights: [],
    icon: Link2,
  },
];

export function OnboardingView({
  integrations,
  onToggleIntegration,
  onComplete,
}: {
  integrations: IntegrationConnector[];
  onToggleIntegration: (id: string, connect: boolean) => void;
  onComplete: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const current = ONBOARDING_STEPS[stepIdx];
  const Icon = current.icon;
  const googleIntegrations = integrations.filter((i) => i.category === 'Google Workspace');

  return (
    <div className="mx-auto max-w-2xl py-6">
      <Surface className="divide-y divide-border/60">
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-xs font-medium text-muted tabular-nums">
            Step {current.step} of {ONBOARDING_STEPS.length}
          </span>
          <Button tone="quiet" className="px-3" onClick={onComplete}>
            Skip to dashboard
          </Button>
        </div>

        <div className="space-y-4 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-foreground">{current.title}</h1>
          </div>

          <p className="max-w-[62ch] text-base leading-relaxed text-muted">{current.body}</p>

          {current.highlights.length > 0 ? (
            <ul className="space-y-2.5 border-t border-border/60 pt-4">
              {current.highlights.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-border/50 border-t border-border/60 pt-2">
              {googleIntegrations.map((conn) => (
                <li
                  key={conn.id}
                  className="flex items-center justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{conn.name}</p>
                    <p className="text-xs text-muted">{conn.permissions[0]}</p>
                  </div>
                  <Button
                    tone={conn.connected ? 'quiet' : 'primary'}
                    onClick={() => onToggleIntegration(conn.id, !conn.connected)}
                  >
                    {conn.connected ? 'Connected' : 'Connect'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <Button
            tone="quiet"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </Button>

          {stepIdx < ONBOARDING_STEPS.length - 1 ? (
            <Button onClick={() => setStepIdx((i) => i + 1)}>
              Next
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={onComplete}>Finish setup</Button>
          )}
        </div>
      </Surface>
    </div>
  );
}

export function AuthScreen({
  onGoogleSignIn,
  onEmailSignIn,
  onEmailRegister,
  onPasswordReset,
  onCancel,
}: {
  onGoogleSignIn: () => Promise<UserProfile>;
  onEmailSignIn: (email: string, password: string) => Promise<UserProfile>;
  onEmailRegister: (name: string, email: string, password: string) => Promise<UserProfile>;
  onPasswordReset: (email: string) => Promise<string>;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'signin' | 'register' | 'reset'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('zakiabdulrehman4@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      if (mode === 'reset') {
        const msg = await onPasswordReset(email);
        setStatusMsg(msg);
      } else if (mode === 'register') {
        await onEmailRegister(name, email, password);
      } else {
        await onEmailSignIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await onGoogleSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-6">
      <Surface className="divide-y divide-border/60">
        <div className="space-y-1 p-6">
          <h1 className="text-2xl font-semibold text-foreground">
            {mode === 'signin'
              ? 'Sign in to LifePilot AI'
              : mode === 'register'
                ? 'Create your LifePilot account'
                : 'Reset your password'}
          </h1>
          <p className="text-sm text-muted">
            Firebase Authentication tokens are verified on the backend before accessing your workspace.
          </p>
        </div>

        <div className="space-y-4 p-6">
          {mode !== 'reset' ? (
            <Button
              tone="quiet"
              className="w-full"
              disabled={busy}
              onClick={handleGoogle}
            >
              Continue with Google
            </Button>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' ? (
              <Field
                id="auth-name"
                label="Full name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Abdul Rehman"
              />
            ) : null}

            <Field
              id="auth-email"
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            {mode !== 'reset' ? (
              <Field
                id="auth-password"
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            ) : null}

            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            {statusMsg ? (
              <p role="status" className="text-sm font-medium text-success">
                {statusMsg}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {mode === 'signin'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : 'Send reset link'}
            </Button>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
          {mode === 'signin' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('register');
                }}
                className="min-h-11 text-sm font-medium text-primary hover:underline"
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('reset');
                }}
                className="min-h-11 text-sm font-medium text-muted hover:text-foreground"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('signin');
              }}
              className="min-h-11 text-sm font-medium text-primary hover:underline"
            >
              Back to sign in
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 text-sm text-muted hover:text-foreground"
          >
            Return to dashboard
          </button>
        </div>
      </Surface>
    </div>
  );
}
