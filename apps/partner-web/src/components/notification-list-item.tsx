'use client';

import { useRouter } from 'next/navigation';
import {
  formatNotificationTime,
  notificationActionLabel,
  notificationRouteToPath,
  PARTNER_NOTIFICATION_CATEGORY_LABELS,
  resolveNotificationCategory,
  resolvePortalNotificationRoute,
  type PortalNotification,
} from '../lib/notification-types';

export function NotificationListItem({
  notification,
  onMarkRead,
}: {
  notification: PortalNotification;
  onMarkRead?: (id: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const route = resolvePortalNotificationRoute(notification);
  const category = resolveNotificationCategory(notification);

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
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-medium text-slate-900 ${notification.read ? '' : 'font-semibold'}`}>
              {notification.title}
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {PARTNER_NOTIFICATION_CATEGORY_LABELS[category]}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{notification.body}</p>
          {notification.data?.branchName && (
            <p className="mt-1 text-xs text-muted-foreground">{notification.data.branchName}</p>
          )}
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
