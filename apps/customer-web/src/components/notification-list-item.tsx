'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  formatNotificationTime,
  notificationActionLabel,
  notificationRouteToPath,
  resolveNotificationRoute,
  type AppNotification,
} from '../lib/notification-types';

export function NotificationListItem({
  notification,
  onMarkRead,
}: {
  notification: AppNotification;
  onMarkRead?: (id: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const route = resolveNotificationRoute(notification);

  async function handleClick() {
    if (!notification.read) {
      await onMarkRead?.(notification._id);
    }
    if (route) {
      router.push(notificationRouteToPath(route));
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full rounded-xl bg-surface p-4 text-left ring-1 transition-shadow hover:shadow-[var(--shadow-elevated)] ${
        notification.read ? 'ring-border/40' : 'ring-primary/25 bg-primary/5'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${notification.read ? 'bg-transparent' : 'bg-primary'}`}
        />
        <div className="min-w-0 flex-1">
          <p className={`font-medium text-slate-900 ${notification.read ? '' : 'font-semibold'}`}>
            {notification.title}
          </p>
          <p className="mt-1 text-sm text-muted">{notification.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatNotificationTime(notification.createdAt)}
          </p>
          {route && (
            <p className="mt-2 text-sm font-medium text-primary">{notificationActionLabel(route)}</p>
          )}
        </div>
      </div>
    </button>
  );
}

export function NotificationListItemLink({
  notification,
}: {
  notification: AppNotification;
}) {
  const route = resolveNotificationRoute(notification);
  if (!route) return null;
  return (
    <Link href={notificationRouteToPath(route)} className="text-sm font-medium text-primary">
      {notificationActionLabel(route)}
    </Link>
  );
}
