import type { MenuListProps } from '@lunara/blocks';

export function MenuListPreview({ title, items }: MenuListProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <div className="divide-y divide-border/60 rounded-lg bg-surface ring-1 ring-border/60">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-1.5 py-1">
            <p className={`text-[8px] font-medium ${item.danger ? 'text-red-500' : 'text-slate-800'}`}>{item.label}</p>
            {item.value ? <p className="text-[8px] text-muted">{item.value}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
