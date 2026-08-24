'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { CustomerTimelineStep } from '@lunara/utils';

function formatStepTime(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OrderTimeline({ steps }: { steps: CustomerTimelineStep[] }) {
  const [expanded, setExpanded] = useState(false);

  const activeStep =
    steps.find((s) => s.state === 'current') ?? [...steps].reverse().find((s) => s.state === 'done');

  return (
    <div>
      {activeStep && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full min-h-11 items-center gap-4 rounded-lg text-left transition-colors hover:bg-slate-50"
        >
          <span
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              activeStep.state === 'current'
                ? 'bg-primary text-white ring-4 ring-indigo-100'
                : 'bg-accent text-white'
            }`}
          >
            {activeStep.state === 'done' ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" aria-hidden />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-slate-900">{activeStep.label}</span>
            <span className="block text-xs text-slate-500">
              {activeStep.timestamp
                ? formatStepTime(activeStep.timestamp)
                : activeStep.state === 'current'
                  ? 'In progress…'
                  : null}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      )}

      {expanded && (
        <ol className="relative mt-4 space-y-0 border-t border-border/50 pt-4">
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
                {step.state === 'done' ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : step.state === 'current' ? (
                  <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
                ) : null}
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
                  {step.label}
                </p>
                {step.timestamp && (
                  <p className="mt-0.5 text-xs text-slate-500">{formatStepTime(step.timestamp)}</p>
                )}
                {step.state === 'current' && !step.timestamp && (
                  <p className="mt-0.5 text-xs text-primary">In progress…</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
