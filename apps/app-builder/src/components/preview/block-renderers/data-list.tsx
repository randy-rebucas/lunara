import type { DataListProps } from '@lunara/blocks';

export function DataListPreview({ title, emptyStateText, items }: DataListProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      {items.length === 0 ? (
        <p className="text-[8px] text-muted">{emptyStateText ?? 'Nothing here yet'}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg bg-surface p-1.5 ring-1 ring-border/60">
              <div className="min-w-0">
                <p className="truncate text-[8px] font-semibold text-slate-900">{item.title}</p>
                {item.subtitle ? <p className="truncate text-[8px] text-muted">{item.subtitle}</p> : null}
              </div>
              {item.badge ? (
                <span className="ml-1 shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[7px] text-white">{item.badge}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
