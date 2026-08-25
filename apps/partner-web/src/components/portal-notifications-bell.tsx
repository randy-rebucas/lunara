'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../hooks/use-notifications';
import { usePartnerNotificationsSocket } from '../lib/use-partner-notifications-socket';
import { NotificationListItem } from './notification-list-item';

export function PortalNotificationsBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { items, unreadCount, refresh, markRead } = useNotifications(30);

  usePartnerNotificationsSocket({
    onNotification: () => {
      void refresh();
    },
  });

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
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-slate-100 hover:text-primary"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
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
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-2 top-16 z-50 rounded-xl bg-surface shadow-[var(--shadow-elevated)] ring-1 ring-border/60 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <p className="text-xs text-muted">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : 'Orders, pickups, and processing updates'}
            </p>
          </div>

          <div className="max-h-[min(24rem,70vh)] overflow-y-auto p-3 space-y-2">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted">No notifications yet</p>
            ) : (
              items.slice(0, 5).map((item) => (
                <NotificationListItem
                  key={item._id}
                  notification={item}
                  onMarkRead={markRead}
                />
              ))
            )}
          </div>

          <div className="border-t border-border/60 px-4 py-3">
            <Link href="/notifications" className="btn-primary btn-sm w-full text-center" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
