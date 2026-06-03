'use client';

import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { NotificationListItem } from '../../components/notification-list-item';
import { PageHeader } from '../../components/ui/page-header';
import { useNotifications } from '../../hooks/use-notifications';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { UserRole } from '@lunara/types';
import { usePartnerNotificationsSocket } from '../../lib/use-partner-notifications-socket';

export default function NotificationsPage() {
  const { ready } = useProtectedPage({
    roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN],
  });
  const { items, loading, refreshing, error, unreadCount, refresh, markRead, markAllRead, load } =
    useNotifications(50);

  usePartnerNotificationsSocket({
    onNotification: () => {
      void refresh();
    },
  });

  if (!ready) return <AuthLoading message="Loading notifications…" />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="New bookings, pickup and delivery updates, shop receiving, and processing alerts."
        actions={
          unreadCount > 0 ? (
            <button type="button" className="btn-outline btn-sm" onClick={() => markAllRead()}>
              Mark all read
            </button>
          ) : undefined
        }
      />

      {unreadCount > 0 && (
        <p className="mb-4 text-sm text-primary">
          {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
        </p>
      )}

      <DataPageStatus
        loading={loading && items.length === 0}
        error={error}
        loadingMessage="Loading notifications…"
      />

      {error && items.length === 0 ? (
        <button type="button" onClick={load} className="mt-4 text-sm link-primary">
          Try again
        </button>
      ) : null}

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <NotificationListItem key={item._id} notification={item} onMarkRead={markRead} />
        ))}
        {!loading && !error && items.length === 0 && (
          <div className="card card-body text-center text-sm text-muted">
            <p className="font-medium text-slate-900">No notifications yet</p>
            <p className="mt-2">
              You will be notified when orders are assigned to your shop, when riders pick up or
              deliver laundry, and when processing milestones change.
            </p>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="text-sm link-primary disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}
    </div>
  );
}
