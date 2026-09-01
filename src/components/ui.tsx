import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-ink)] text-[13px] font-bold text-white">
        N5
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight">N5Deal</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">
            M&amp;A Deals Platform
          </span>
        </span>
      )}
    </Link>
  );
}

const TONES = {
  neutral: "bg-[var(--color-canvas)] text-[var(--color-ink-soft)]",
  accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  positive: "bg-[var(--color-positive-soft)] text-[var(--color-positive)]",
  warn: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  dark: "bg-[var(--color-ink)] text-white",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold tracking-tight ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-[12px] text-[var(--color-muted)]">{hint}</p>}
      {error && <p className="mt-1 text-[12px] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {body && <p className="max-w-md text-sm text-[var(--color-muted)]">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">{label}</p>
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-[var(--color-line)] py-3 last:border-0">
      <dt className="text-[12.5px] text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

export function SectionHeading({
  title,
  action,
  description,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="section-title">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
