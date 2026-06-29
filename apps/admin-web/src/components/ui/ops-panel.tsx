import { cn } from '@lunara/ui';

export function OpsPanel({
  title,
  description,
  children,
  className,
  headerAction,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}) {
  return (
    <section className={cn('dc-panel flex h-full flex-col', className)}>
      <div className="dc-panel-header flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="text-xs text-muted">{description}</p> : null}
        </div>
        {headerAction}
      </div>
      <div className="dc-panel-body flex flex-1 flex-col">{children}</div>
    </section>
  );
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-1.5 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
