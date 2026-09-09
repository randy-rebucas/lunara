'use client';

import Link from 'next/link';

export interface SetupGuideStep {
  key: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
}

export function SetupGuide({
  steps,
  open,
  onToggle,
  onDismiss,
}: {
  steps: SetupGuideStep[];
  open: boolean;
  onToggle: () => void;
  onDismiss: () => void;
}) {
  const completedCount = steps.filter((s) => s.done).length;
  const pct = steps.length === 0 ? 0 : Math.round((completedCount / steps.length) * 100);

  return (
    <div data-tour="setup-guide" className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="card-elevated w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden">
          <div className="card-body">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Finish setting up your shop</h3>
                <p className="mt-0.5 text-sm text-muted">
                  {completedCount} of {steps.length} steps complete
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm text-muted hover:text-slate-700"
                aria-label="Dismiss setup guide"
              >
                Dismiss
              </button>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>

            <ul className="mt-4 max-h-[60vh] divide-y divide-border/60 overflow-y-auto">
              {steps.map((step) => (
                <li key={step.key}>
                  <Link
                    href={step.href}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-slate-50/80"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        step.done ? 'bg-accent/10 text-accent' : 'border border-slate-300 text-transparent'
                      }`}
                      aria-hidden
                    >
                      {step.done ? '✓' : ''}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${step.done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{step.description}</p>
                    </div>
                    {!step.done && <span className="text-sm text-muted">→</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Collapse setup guide' : 'Open setup guide'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105"
      >
        {open ? (
          <span className="text-xl leading-none">×</span>
        ) : (
          <span className="text-sm font-semibold">
            {completedCount}/{steps.length}
          </span>
        )}
      </button>
    </div>
  );
}
