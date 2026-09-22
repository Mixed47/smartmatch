import type { ReactNode } from 'react';

/** Inline loading spinner. Inherits the current text color. */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/** Text label + spinner, for inline "loading" rows. */
export function LoadingRow({ label = 'กำลังโหลดข้อมูล...' }: { label?: string }) {
  return (
    <p className="flex items-center justify-center gap-2.5 py-8 text-sm font-medium text-ink-muted" role="status">
      <Spinner />
      {label}
    </p>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Card-shaped placeholder used while lists are loading. */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card card-pad space-y-3" aria-hidden="true">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === rows - 1 ? 'w-2/5' : 'w-4/5'}`} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3, rows = 3 }: { count?: number; rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="กำลังโหลดข้อมูล">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} rows={rows} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="mb-1 text-ink-subtle">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-text">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Page heading block: title + optional subtitle + optional right-side slot. */
export function PageHeading({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
