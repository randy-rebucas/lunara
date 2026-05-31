'use client';

import type { CustomerTimelineStep } from '@lunara/utils';

export function OrderTimeline({ steps }: { steps: CustomerTimelineStep[] }) {
  return (
    <ol className="relative space-y-0">
      {steps.map((step, index) => (
        <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
          {index < steps.length - 1 && (
            <span
              className={`absolute left-[11px] top-6 h-full w-0.5 ${
                step.state === 'done' ? 'bg-accent' : 'bg-slate-200'
              }`}
              aria-hidden
            />
          )}
          <span
            className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              step.state === 'done'
                ? 'bg-accent text-white'
                : step.state === 'current'
                  ? 'bg-primary text-white ring-4 ring-indigo-100'
                  : 'ring-2 ring-border/60 bg-surface text-slate-400'
            }`}
          >
            {step.state === 'done' ? '✓' : step.state === 'current' ? '●' : ''}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p
              className={`font-medium ${
                step.state === 'current'
                  ? 'text-primary'
                  : step.state === 'done'
                    ? 'text-slate-800'
                    : 'text-slate-400'
              }`}
            >
              {step.state === 'done' ? '✓ ' : ''}
              {step.label}
            </p>
            {step.timestamp && (
              <p className="mt-0.5 text-xs text-slate-500">
                {new Date(step.timestamp).toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            )}
            {step.state === 'current' && !step.timestamp && (
              <p className="mt-0.5 text-xs text-primary">In progress…</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
