import type { StatusTimelineProps } from '@lunara/blocks';

export function StatusTimelinePreview({ title, currentStatus, steps }: StatusTimelineProps) {
  const currentIndex = steps.findIndex((s) => s.status === currentStatus);
  return (
    <div className="rounded-xl bg-surface p-2 ring-1 ring-border/60">
      {title ? <p className="mb-1 text-[9px] font-semibold text-slate-900">{title}</p> : null}
      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <div key={step.status} className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${i <= currentIndex ? 'bg-primary' : 'bg-border'}`}
            />
            <p className="text-[8px] text-slate-700">{step.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
