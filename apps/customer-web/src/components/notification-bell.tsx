'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotifications } from '../hooks/use-notifications';

export function NotificationBell() {
  const pathname = usePathname();
  const { unreadCount } = useNotifications(15);
  const active = pathname.startsWith('/notifications');

  return (
    <Link
      href="/notifications"
      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted hover:bg-slate-100 hover:text-primary'
      }`}
      aria-label={
        unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
      }
      title="Notifications"
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
      {unreadCount > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
