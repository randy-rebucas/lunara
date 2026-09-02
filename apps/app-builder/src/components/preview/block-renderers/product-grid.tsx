import type { ProductGridProps } from '@lunara/blocks';

export function ProductGridPreview({ title, columns, items }: ProductGridProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <div key={item.id} className="rounded-lg bg-surface p-1.5 ring-1 ring-border/60">
            <div className="mb-1 aspect-square rounded-md bg-muted/40" />
            <p className="truncate text-[8px] font-medium text-slate-900">{item.name}</p>
            {item.price ? <p className="text-[8px] font-semibold text-primary">{item.price}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
