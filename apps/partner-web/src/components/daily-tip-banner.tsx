'use client';

import { useEffect, useRef } from 'react';

const AUTO_CLOSE_MS = 8000;

export function DailyTipBanner({ tip, onDismiss }: { tip: string; onDismiss: () => void }) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div className="daily-tip-flash flex w-full max-w-xl items-start gap-3 rounded-lg border border-primary/20 bg-white px-4 py-3 shadow-lg">
        <span className="mt-0.5 text-lg leading-none" aria-hidden>
          💡
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tip of the day</p>
          <p className="mt-0.5 text-sm text-slate-800">{tip}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm text-muted hover:text-slate-700"
          aria-label="Dismiss tip"
        >
          ×
        </button>
      </div>
    </div>
  );
}
