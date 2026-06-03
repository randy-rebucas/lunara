'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAdminSos } from './admin-sos-provider';
import { SosIncidentBanner } from './sos-incident-banner';

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const sos = useAdminSos();

  const liveId = sos.liveAlert?.type === 'rider_sos' ? sos.liveAlert.incidentId : undefined;
  const sosCount =
    sos.incidents.length +
    (liveId && !sos.incidents.some((i) => i.incidentId === liveId) ? 1 : 0);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-primary"
        aria-label={sosCount > 0 ? `${sosCount} active alerts` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {sosCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {sosCount > 9 ? '9+' : sosCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-surface shadow-[var(--shadow-elevated)] ring-1 ring-border/60">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Alerts</p>
            <p className="text-xs text-muted">SOS incidents and live dispatch updates</p>
          </div>

          <div className="max-h-[min(24rem,70vh)] overflow-y-auto p-3">
            {sosCount === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted">No active SOS alerts</p>
            ) : (
              <SosIncidentBanner
                incidents={sos.incidents}
                liveAlert={sos.liveAlert}
                liveLocations={sos.liveLocations}
                resolvingId={sos.resolvingId}
                resolveError={sos.resolveError}
                onResolve={sos.handleResolve}
                onDismissAlert={sos.dismissLiveAlert}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3">
            <Link href="/dispatch" className="btn-primary btn-sm" onClick={() => setOpen(false)}>
              Dispatch
            </Link>
            <Link
              href="/control-tower"
              className="btn-outline btn-sm"
              onClick={() => setOpen(false)}
            >
              Control tower
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
