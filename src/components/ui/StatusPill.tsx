import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface StatusPillProps {
  tone?: PillTone;
  dot?: boolean;
  pulse?: boolean;
  title?: string;
  children: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<PillTone, string> = {
  neutral: 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)]',
  success: 'border-[var(--status-success-border)] bg-[var(--status-success-subtle)] text-[var(--status-success-text)]',
  warning: 'border-[var(--status-warning-border)] bg-[var(--status-warning-subtle)] text-[var(--status-warning-text)]',
  danger: 'border-[var(--status-danger-border)] bg-[var(--status-danger-subtle)] text-[var(--status-danger-text)]',
  info: 'border-[var(--status-info-border)] bg-[var(--status-info-subtle)] text-[var(--status-info-text)]',
  accent: 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)]',
};

const DOT_CLASS: Record<PillTone, string> = {
  neutral: 'bg-[var(--text-muted)]',
  success: 'bg-[var(--status-success)]',
  warning: 'bg-[var(--status-warning)]',
  danger: 'bg-[var(--status-danger)]',
  info: 'bg-[var(--status-info)]',
  accent: 'bg-[var(--accent-primary)]',
};

export default function StatusPill({
  tone = 'neutral',
  dot = false,
  pulse = false,
  title,
  children,
  className = '',
}: StatusPillProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[tone]} ${pulse ? 'animate-pulse' : ''}`}
        />
      )}
      {children}
    </span>
  );
}
