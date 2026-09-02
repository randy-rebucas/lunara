import type { ListProps } from '@lunara/blocks';

export function ListPreview({ title, items }: ListProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg bg-surface p-1.5 ring-1 ring-border/60">
            <p className="truncate text-[9px] font-semibold text-slate-900">{item.label}</p>
            {item.description ? (
              <p className="truncate text-[8px] text-muted">{item.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
