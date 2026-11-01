import React, { useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Link2,
  LogOut,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sun,
  Unlink,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type {
  IntegrationConnector,
  NotificationPreferences,
  WorkspaceState,
} from '../domain/types';
import { Button, Field, ModalDialog, Surface } from '../components/ui';

export function ProfileScreen({
  state,
  offlineMode,
  pendingOfflineCount,
  busy,
  onToggleTheme,
  onToggleOfflineMode,
  onFlushOfflineQueue,
  onToggleIntegration,
  onSyncIntegration,
  onMarkNotificationsRead,
  onUpdateNotificationPreferences,
  onLaunchOnboarding,
  onOpenAuthScreen,
  onResetWorkspace,
}: {
  state: WorkspaceState;
  offlineMode: boolean;
  pendingOfflineCount: number;
  busy: boolean;
  onToggleTheme: () => void;
  onToggleOfflineMode: () => void;
  onFlushOfflineQueue: () => void;
  onToggleIntegration: (id: string, connect: boolean, accountLabel?: string) => void;
  onSyncIntegration: (id: string) => void;
  onMarkNotificationsRead: (id: string | 'all') => void;
  onUpdateNotificationPreferences: (patch: Partial<NotificationPreferences>) => void;
  onLaunchOnboarding: () => void;
  onOpenAuthScreen: () => void;
  onResetWorkspace: () => void;
}) {
  const [oauthTarget, setOauthTarget] = useState<IntegrationConnector | null>(null);
  const [oauthAccount, setOauthAccount] = useState(state.user.email);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  const handleConfirmConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthTarget) return;
    onToggleIntegration(oauthTarget.id, true, oauthAccount.trim() || state.user.email);
    setOauthTarget(null);
  };

  const preferenceItems: Array<{
    key: keyof NotificationPreferences;
    label: string;
    detail: string;
  }> = [
    {
      key: 'approvalRequests',
      label: 'Human approval requests',
      detail: 'Alert immediately when a high-risk workflow step pauses for approval.',
    },
    {
      key: 'meetingReminders',
      label: 'Meeting preparation & 2-hour alerts',
      detail: 'Send pre-meeting briefs and conflict warnings ahead of calendar events.',
    },
    {
      key: 'taskReminders',
      label: 'Task & recurring reminders',
      detail: 'Deliver local WorkManager and Firebase Cloud Messaging reminders.',
    },
    {
      key: 'deadlineAlerts',
      label: 'Deadline alerts',
      detail: 'Warn when high-priority tasks approach due time.',
    },
    {
      key: 'workflowCompletion',
      label: 'Workflow completion updates',
      detail: 'Notify when multi-step background workflows complete or fail.',
    },
    {
      key: 'aiRecommendations',
      label: 'Next best action suggestions',
      detail: 'Share proactive focus window recommendations.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Account, Security, Offline Cache & Session Controls */}
      <Surface className="divide-y divide-border/60">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">{state.user.name}</h2>
            <p className="text-sm text-muted">
              {state.user.email} · {state.user.roleTitle}
            </p>
            <p className="flex items-center gap-1.5 pt-1 text-xs text-success">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Firebase session verified ({state.user.authProvider === 'google' ? 'Google Sign-In' : 'Email Auth'}) · UID{' '}
                <span className="font-mono">{state.user.firebaseUid}</span>
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button tone="quiet" onClick={onToggleTheme}>
              {state.user.theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4" aria-hidden="true" />
                  Light mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" aria-hidden="true" />
                  Dark mode
                </>
              )}
            </Button>
            <Button tone="quiet" onClick={onLaunchOnboarding}>
              <Compass className="h-4 w-4" aria-hidden="true" />
              Onboarding tour
            </Button>
            <Button tone="quiet" onClick={onOpenAuthScreen}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Switch account
            </Button>
          </div>
        </div>

        {/* Offline Room-equivalent Cache & Synchronization Control */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="space-y-0.5">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              {offlineMode ? (
                <WifiOff className="h-4 w-4 text-warning" aria-hidden="true" />
              ) : (
                <Wifi className="h-4 w-4 text-success" aria-hidden="true" />
              )}
              <span>
                {offlineMode
                  ? `Offline cache active · ${pendingOfflineCount} local changes waiting to sync`
                  : 'Online & synchronized with backend'}
              </span>
            </p>
            <p className="text-xs text-muted">
              Tasks and reminders work offline via local cache and reconcile automatically when reconnected.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pendingOfflineCount > 0 && !offlineMode ? (
              <Button disabled={busy} onClick={onFlushOfflineQueue}>
                Sync {pendingOfflineCount} changes
              </Button>
            ) : null}
            <Button tone="quiet" onClick={onToggleOfflineMode}>
              {offlineMode ? 'Reconnect & sync' : 'Test offline mode'}
            </Button>
            <Button tone="quiet" onClick={() => setConfirmResetOpen(true)}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset data
            </Button>
          </div>
        </div>
      </Surface>

      {/* Integrations Hub: Google Calendar, Gmail, Drive + Extensible Connectors */}
      <Surface className="divide-y divide-border/60">
        <div className="px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">Connected integrations</h3>
          <p className="text-xs text-muted">
            Explicit OAuth authorization managed on backend — tokens are never stored in plain text on device.
          </p>
        </div>

        <ul className="divide-y divide-border/50">
          {state.integrations.map((conn) => (
            <li
              key={conn.id}
              className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 sm:flex-nowrap"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-medium text-foreground">{conn.name}</p>
                  <span className="text-xs text-muted">
                    ·{' '}
                    <span
                      className={
                        conn.connected ? 'font-medium text-success' : 'text-muted'
                      }
                    >
                      {conn.connected ? 'Connected' : 'Disconnected'}
                    </span>
                    {' · '}
                    {conn.category}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  Permissions: {conn.permissions.join(' · ')}
                </p>
                <p className="text-xs text-muted tabular-nums">
                  {conn.connected
                    ? `${conn.lastSyncAt || 'Synced'} · ${conn.accountLabel || state.user.email}`
                    : 'Not authorized yet'}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {conn.connected ? (
                  <>
                    <Button
                      tone="quiet"
                      disabled={busy}
                      aria-label={`Sync ${conn.name}`}
                      onClick={() => onSyncIntegration(conn.id)}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Sync
                    </Button>
                    <Button
                      tone="quiet"
                      disabled={busy}
                      aria-label={`Disconnect ${conn.name}`}
                      onClick={() => onToggleIntegration(conn.id, false)}
                    >
                      <Unlink className="h-4 w-4" aria-hidden="true" />
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={busy}
                    aria-label={`Connect ${conn.name}`}
                    onClick={() => {
                      setOauthAccount(state.user.email);
                      setOauthTarget(conn);
                    }}
                  >
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                    Connect
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Surface>

      {/* Two-column Notifications Feed + Notification Preferences */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Surface className="divide-y divide-border/60">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Recent notifications</h3>
                <p className="text-xs text-muted tabular-nums">{unreadCount} unread alerts</p>
              </div>
              {unreadCount > 0 ? (
                <Button tone="quiet" onClick={() => onMarkNotificationsRead('all')}>
                  Mark all read
                </Button>
              ) : null}
            </div>

            <ul className="divide-y divide-border/50">
              {state.notifications.slice(0, 6).map((ntf) => (
                <li
                  key={ntf.id}
                  className="flex items-start justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p
                      className={`text-sm ${
                        ntf.read ? 'text-muted' : 'font-semibold text-foreground'
                      }`}
                    >
                      {ntf.title}
                    </p>
                    <p className="text-xs text-muted">{ntf.body}</p>
                    <p className="text-xs text-muted tabular-nums">{ntf.createdAt}</p>
                  </div>
                  {!ntf.read ? (
                    <Button
                      tone="quiet"
                      className="shrink-0 px-3"
                      aria-label={`Mark "${ntf.title}" read`}
                      onClick={() => onMarkNotificationsRead(ntf.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Read
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Surface>
        </div>

        <div className="lg:col-span-6">
          <Surface className="divide-y divide-border/60">
            <div className="px-5 py-4">
              <h3 className="text-base font-semibold text-foreground">
                Notification preferences
              </h3>
              <p className="text-xs text-muted">
                Choose which push and background alerts LifePilot sends.
              </p>
            </div>

            <ul className="divide-y divide-border/50">
              {preferenceItems.map((pref) => {
                const enabled = state.notificationPreferences[pref.key];
                return (
                  <li
                    key={pref.key}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{pref.label}</p>
                      <p className="text-xs text-muted">{pref.detail}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={pref.label}
                      onClick={() =>
                        onUpdateNotificationPreferences({ [pref.key]: !enabled })
                      }
                      className={`inline-flex min-h-11 min-w-16 shrink-0 items-center justify-center rounded-control border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                        enabled
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface text-muted'
                      }`}
                    >
                      {enabled ? 'On' : 'Off'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Surface>
        </div>
      </div>

      {/* Explicit OAuth Authorization Dialog */}
      <ModalDialog
        open={Boolean(oauthTarget)}
        onClose={() => setOauthTarget(null)}
        title={oauthTarget ? `Authorize ${oauthTarget.name}` : 'Authorize integration'}
        description="Review requested scopes before granting LifePilot backend connector access."
      >
        {oauthTarget ? (
          <form onSubmit={handleConfirmConnect} className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Permissions requested:</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {oauthTarget.permissions.map((perm) => (
                  <li key={perm}>{perm}</li>
                ))}
              </ul>
            </div>

            <Field
              id="oauth-account-email"
              label="Account to link"
              type="email"
              required
              value={oauthAccount}
              onChange={(e) => setOauthAccount(e.target.value)}
            />

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button tone="quiet" onClick={() => setOauthTarget(null)}>
                Cancel
              </Button>
              <Button type="submit">Authorize & connect</Button>
            </div>
          </form>
        ) : null}
      </ModalDialog>

      {/* Confirm Workspace Reset Dialog */}
      <ModalDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset workspace data?"
        description="This restores initial tasks, workflows, reminders, and connected integrations."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button tone="quiet" onClick={() => setConfirmResetOpen(false)}>
            Keep current data
          </Button>
          <Button
            tone="danger"
            onClick={() => {
              setConfirmResetOpen(false);
              onResetWorkspace();
            }}
          >
            Reset workspace
          </Button>
        </div>
      </ModalDialog>
    </div>
  );
}
