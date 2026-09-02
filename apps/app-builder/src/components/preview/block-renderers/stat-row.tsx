import type { StatRowProps } from '@lunara/blocks';

export function StatRowPreview({ title, stats }: StatRowProps) {
  return (
    <div>
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <div className="flex justify-between">
        {stats.map((stat) => (
          <div key={stat.id} className="text-center">
            <p className="text-[10px] font-bold text-primary">{stat.value}</p>
            <p className="text-[7px] text-muted">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
