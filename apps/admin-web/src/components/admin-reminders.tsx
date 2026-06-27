'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '../lib/admin-api';

/* ── Types ──────────────────────────────────────────────────── */

interface DashboardData {
  pendingDispatch: number;
  openTickets: number;
  activeOrders: number;
  ridersOnline: number;
  slaBreaches?: number;
  conflicts?: number;
}

interface SosIncident {
  _id: string;
  riderName?: string;
  createdAt: string;
}

interface PendingDoc {
  _id: string;
  riderName?: string;
}

interface Reminder {
  id: string;
  level: 'urgent' | 'warning' | 'info';
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}

/* ── Poll interval ──────────────────────────────────────────── */

const POLL_MS = 90_000; // 90 seconds

/* ── Helpers ────────────────────────────────────────────────── */

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function buildReminders(
  dash: DashboardData | null,
  sos: SosIncident[],
  docs: PendingDoc[],
): Reminder[] {
  const list: Reminder[] = [];

  // SOS — always urgent
  if (sos.length > 0) {
    list.push({
      id: 'sos',
      level: 'urgent',
      title: `SOS Alert — ${plural(sos.length, 'active incident')}`,
      body: 'Rider(s) have triggered an SOS. Immediate attention required.',
      href: '/riders',
      linkLabel: 'View riders',
    });
  }

  if (dash) {
    // SLA breaches
    if ((dash.slaBreaches ?? 0) > 0) {
      list.push({
        id: 'sla',
        level: 'urgent',
        title: `${plural(dash.slaBreaches!, 'SLA breach')} detected`,
        body: 'Orders have exceeded their delivery SLA. Check control tower.',
        href: '/control-tower',
        linkLabel: 'Control tower',
      });
    }

    // Operations conflicts
    if ((dash.conflicts ?? 0) > 0) {
      list.push({
        id: 'conflicts',
        level: 'urgent',
        title: `${plural(dash.conflicts!, 'order conflict')} flagged`,
        body: 'Orders have been flagged with operational conflicts.',
        href: '/control-tower',
        linkLabel: 'Control tower',
      });
    }

    // Pending dispatch
    if (dash.pendingDispatch > 0) {
      list.push({
        id: 'dispatch',
        level: 'warning',
        title: `${plural(dash.pendingDispatch, 'order')} awaiting dispatch`,
        body: 'Unassigned orders are waiting in the dispatch queue.',
        href: '/dispatch',
        linkLabel: 'Go to dispatch',
      });
    }

    // Open support tickets
    if (dash.openTickets > 0) {
      list.push({
        id: 'tickets',
        level: 'warning',
        title: `${plural(dash.openTickets, 'open support ticket')}`,
        body: 'Customers are waiting for support. Please triage.',
        href: '/support',
        linkLabel: 'View tickets',
      });
    }

    // No riders online
    if (dash.ridersOnline === 0 && dash.activeOrders > 0) {
      list.push({
        id: 'no-riders',
        level: 'urgent',
        title: 'No riders online',
        body: `${plural(dash.activeOrders, 'active order')} but zero riders are online.`,
        href: '/riders',
        linkLabel: 'View riders',
      });
    }
  }

  // Pending rider documents
  if (docs.length > 0) {
    list.push({
      id: 'rider-docs',
      level: 'info',
      title: `${plural(docs.length, 'rider document')} pending review`,
      body: 'Rider verification documents are waiting for approval.',
      href: '/riders',
      linkLabel: 'View riders',
    });
  }

  return list;
}

/* ── Toast component ────────────────────────────────────────── */

const LEVEL_STYLES = {
  urgent:  { bar: 'bg-red-500',    bg: 'bg-red-50 border-red-200',    icon: 'text-red-500',    title: 'text-red-900'  },
  warning: { bar: 'bg-amber-400',  bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-500',  title: 'text-amber-900' },
  info:    { bar: 'bg-blue-400',   bg: 'bg-blue-50 border-blue-200',   icon: 'text-blue-500',   title: 'text-slate-900' },
};

function LevelIcon({ level }: { level: Reminder['level'] }) {
  if (level === 'urgent') {
    return (
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  if (level === 'warning') {
    return (
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  );
}

function Toast({ reminder, onDismiss }: { reminder: Reminder; onDismiss: () => void }) {
  const s = LEVEL_STYLES[reminder.level];

  useEffect(() => {
    if (reminder.level === 'info') {
      const t = setTimeout(onDismiss, 8000);
      return () => clearTimeout(t);
    }
  }, [reminder.level, onDismiss]);

  return (
    <div className={`relative flex w-80 overflow-hidden rounded-xl border shadow-lg ${s.bg} animate-in slide-in-from-left-4 fade-in duration-300`}>
      {/* Severity bar */}
      <div className={`w-1 shrink-0 self-stretch ${s.bar}`} />

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className={`flex items-start gap-2 ${s.icon}`}>
          <LevelIcon level={reminder.level} />
          <p className={`text-sm font-semibold leading-tight ${s.title}`}>{reminder.title}</p>
        </div>
        <p className="text-xs leading-snug text-slate-600 pl-6">{reminder.body}</p>
        {reminder.href && (
          <div className="pl-6 pt-0.5">
            <Link
              href={reminder.href}
              onClick={onDismiss}
              className="text-xs font-medium text-primary hover:underline"
            >
              {reminder.linkLabel ?? 'View'} →
            </Link>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:text-slate-700"
        aria-label="Dismiss"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */

export function AdminReminders() {
  const [toasts, setToasts] = useState<Reminder[]>([]);
  const shownRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const poll = useCallback(async () => {
    try {
      const [dashRes, sosRes, docsRes] = await Promise.allSettled([
        adminFetch<DashboardData>('/admin/dashboard'),
        adminFetch<SosIncident[]>('/admin/sos/active'),
        adminFetch<PendingDoc[]>('/admin/riders/documents/pending'),
      ]);

      const dash = dashRes.status === 'fulfilled' ? dashRes.value : null;
      const sos  = sosRes.status  === 'fulfilled' && Array.isArray(sosRes.value)  ? sosRes.value  : [];
      const docs = docsRes.status === 'fulfilled' && Array.isArray(docsRes.value) ? docsRes.value : [];

      const reminders = buildReminders(dash, sos, docs);

      // Only show reminders we haven't shown yet in this session
      // For urgent items, always re-show (in case count changed)
      const toShow = reminders.filter((r) => {
        if (r.level === 'urgent') return true;
        if (shownRef.current.has(r.id)) return false;
        shownRef.current.add(r.id);
        return true;
      });

      if (toShow.length > 0) {
        setToasts((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const fresh = toShow.filter((r) => !existingIds.has(r.id));
          return [...prev, ...fresh];
        });
      }

      // Clear toasts for issues that resolved
      const activeIds = new Set(reminders.map((r) => r.id));
      setToasts((prev) => prev.filter((t) => activeIds.has(t.id)));
    } catch {
      // silent — don't spam if API is down
    }
  }, []);

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll]);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Admin reminders"
      className="fixed bottom-6 left-6 z-50 flex flex-col-reverse gap-2"
    >
      {toasts.map((t) => (
        <Toast key={t.id} reminder={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
