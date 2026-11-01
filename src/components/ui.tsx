import React, { useEffect, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Surface primitive: single outer border level.
 * Never nest a Surface or tinted/bordered sub-box inside another Surface or <aside>.
 * Separate inner sections strictly with whitespace or 1px hairlines (divide-y / border-t).
 */
export const Surface = ({
  inset = false,
  className = '',
  ...props
}: ComponentProps<'div'> & { inset?: boolean }) => (
  <div
    className={`min-w-0 rounded-card text-foreground ${
      inset
        ? 'bg-background'
        : 'border border-border/80 bg-surface shadow-surface'
    } ${className}`}
    {...props}
  />
);

const buttonTones = {
  primary: 'bg-primary text-primary-foreground hover:brightness-95',
  quiet: 'border border-border bg-surface text-foreground hover:bg-background',
  ghost: 'text-foreground hover:bg-background',
  danger: 'bg-danger text-danger-foreground hover:brightness-95',
};

export const Button = ({
  tone = 'primary',
  type = 'button',
  className = '',
  ...props
}: ComponentProps<'button'> & { tone?: keyof typeof buttonTones }) => (
  <button
    type={type}
    className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 text-sm font-medium transition-colors active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${buttonTones[tone]} ${className}`}
    {...props}
  />
);

export const Field = ({
  label,
  id,
  hint,
  className = '',
  ...props
}: ComponentProps<'input'> & { label: string; id: string; hint?: string }) => (
  <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-foreground">
      {label}
    </label>
    <input
      id={id}
      className={`min-h-11 w-full rounded-control border border-border bg-surface px-3.5 text-base text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${className}`}
      {...props}
    />
    {hint ? <p className="text-xs text-muted">{hint}</p> : null}
  </div>
);

export const TextareaField = ({
  label,
  id,
  className = '',
  ...props
}: ComponentProps<'textarea'> & { label: string; id: string }) => (
  <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-foreground">
      {label}
    </label>
    <textarea
      id={id}
      rows={3}
      className={`w-full rounded-control border border-border bg-surface p-3.5 text-base text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${className}`}
      {...props}
    />
  </div>
);

export const SelectField = ({
  label,
  id,
  children,
  className = '',
  ...props
}: ComponentProps<'select'> & { label: string; id: string }) => (
  <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-foreground">
      {label}
    </label>
    <select
      id={id}
      className={`min-h-11 w-full rounded-control border border-border bg-surface px-3.5 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${className}`}
      {...props}
    >
      {children}
    </select>
  </div>
);

export function ModalDialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-card border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-foreground/35"
    >
      <div className="divide-y divide-border/60">
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </dialog>
  );
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-foreground"
        >
          <Surface className="max-w-md p-6">
            <h1 className="text-xl font-semibold">LifePilot encountered an unexpected error</h1>
            <p className="mt-2 text-sm text-muted">{this.state.error.message}</p>
            <div className="mt-5">
              <Button onClick={() => window.location.reload()}>Reload workspace</Button>
            </div>
          </Surface>
        </div>
      );
    }
    return this.props.children;
  }
}
