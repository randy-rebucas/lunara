'use client';

import { useEffect, useRef, useState } from 'react';

interface Task {
  id: string;
  label: string;
  href?: string;
  group: string;
  days?: number[]; // 0=Sun … 6=Sat; undefined = every day
}

const TASKS: Task[] = [
  // Every day
  { id: 'overview',       label: 'Check overview dashboard',        href: '/',               group: 'Morning check' },
  { id: 'control-tower',  label: 'Review control tower',            href: '/control-tower',  group: 'Morning check' },
  { id: 'orders',         label: 'Clear pending orders',            href: '/orders',          group: 'Morning check' },
  { id: 'dispatch',       label: 'Confirm dispatch queue',          href: '/dispatch',        group: 'Morning check' },
  { id: 'riders',         label: 'Check rider availability',        href: '/live-tracking',  group: 'Morning check' },
  { id: 'support',        label: 'Triage support tickets',          href: '/support',         group: 'Daily ops' },
  { id: 'refunds',        label: 'Process pending refunds',         href: '/refunds',         group: 'Daily ops' },
  { id: 'reconciliation', label: 'Review reconciliation',           href: '/reconciliation',  group: 'Finance' },
  // Saturday only (day 6)
  { id: 'settlements',    label: 'Process partner settlements',     href: '/partners/settlements', group: 'Finance', days: [6] },
  // Monday (day 1)
  { id: 'reports',        label: 'Pull weekly reports',             href: '/reports',         group: 'Weekly', days: [1] },
  { id: 'revenue',        label: 'Review weekly revenue',           href: '/revenue',         group: 'Weekly', days: [1] },
];

const STORAGE_KEY = 'lunara_admin_daily_routine';

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function todayDay() {
  return new Date().getDay();
}

function activeTasks() {
  const day = todayDay();
  return TASKS.filter((t) => !t.days || t.days.includes(day));
}

function loadChecked(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const { date, ids } = JSON.parse(raw) as { date: string; ids: string[] };
    if (date !== todayKey()) return new Set(); // new day — reset
    return new Set(ids);
  } catch {
    return new Set();
  }
}

function saveChecked(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), ids: [...ids] }));
}

function groupBy<T>(arr: T[], key: (t: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return [...map.entries()];
}

export function DailyRoutine() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChecked(loadChecked());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveChecked(next);
      return next;
    });
  }

  function resetAll() {
    const empty = new Set<string>();
    saveChecked(empty);
    setChecked(empty);
  }

  if (!mounted) return null;

  const tasks = activeTasks();
  const done = tasks.filter((t) => checked.has(t.id)).length;
  const total = tasks.length;
  const allDone = done === total;
  const groups = groupBy(tasks, (t) => t.group);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = dayNames[todayDay()];

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Panel */}
      {open && (
        <div className="flex w-72 flex-col rounded-2xl border border-border/60 bg-white shadow-xl ring-1 ring-slate-900/5">
          {/* Header */}
          <div className="flex items-start justify-between rounded-t-2xl bg-gradient-to-r from-primary/10 to-violet-500/10 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">Daily routine</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{today}</p>
            </div>
            <div className="flex items-center gap-2">
              {done > 0 && (
                <button
                  type="button"
                  onClick={resetAll}
                  title="Reset checklist"
                  className="rounded-md p-1 text-xs text-muted hover:bg-white/60 hover:text-slate-700"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted hover:bg-white/60 hover:text-slate-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-4 pt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-muted">{done} of {total} done</span>
              {allDone && <span className="text-xs font-semibold text-emerald-600">All clear!</span>}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Task groups */}
          <div className="max-h-80 overflow-y-auto px-2 pb-3 pt-2">
            {groups.map(([group, items]) => (
              <div key={group} className="mb-2">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted/50">
                  {group}
                </p>
                {items.map((task) => {
                  const isChecked = checked.has(task.id);
                  return (
                    <label
                      key={task.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(task.id)}
                        className="h-4 w-4 rounded border-slate-300 accent-primary"
                      />
                      <span className={`flex-1 text-sm ${isChecked ? 'text-muted line-through' : 'text-slate-800'}`}>
                        {task.label}
                      </span>
                      {task.href && !isChecked && (
                        <a
                          href={task.href}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 rounded p-0.5 text-muted hover:text-primary"
                          title="Go to page"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 13l6-6M13 7H7m6 0v6" />
                          </svg>
                        </a>
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Daily routine checklist"
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl active:scale-95"
      >
        {/* Clipboard icon */}
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
        </svg>

        {/* Badge — remaining count */}
        {!allDone && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {total - done}
          </span>
        )}

        {/* All-done green dot */}
        {allDone && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        )}
      </button>
    </div>
  );
}
