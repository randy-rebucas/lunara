import type { FaqProps } from '@lunara/blocks';

export function FaqPreview({ title, items }: FaqProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg bg-surface p-1.5 ring-1 ring-border/60">
            <p className="truncate text-[8px] font-medium text-slate-900">{item.question}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
