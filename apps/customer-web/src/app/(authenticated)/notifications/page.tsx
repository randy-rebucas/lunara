'use client';

import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { NotificationListItem } from '../../../components/notification-list-item';
import { PageShell } from '../../../components/page-shell';
import { PageHeader } from '../../../components/ui/page-header';
import { useNotifications } from '../../../hooks/use-notifications';
import { useProtectedPage } from '../../../hooks/use-protected-page';

export default function NotificationsPage() {
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const { items, loading, refreshing, error, refresh, markRead, load } = useNotifications(50);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading…" />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        description="Order updates, review requests, and refund alerts"
      />

      <DataPageStatus loading={loading && items.length === 0} error={error} loadingMessage="Loading notifications…" />

      {error && items.length === 0 ? (
        <button type="button" onClick={load} className="mt-4 text-sm link-primary">
          Try again
        </button>
      ) : null}

      <div className="mt-6 list-stack">
        {items.map((item) => (
          <NotificationListItem key={item._id} notification={item} onMarkRead={markRead} />
        ))}
        {!loading && !error && items.length === 0 && (
          <div className="panel text-center text-sm text-muted">
            <p className="font-medium text-slate-900">No notifications yet</p>
            <p className="mt-2">Order updates, review requests, and refund alerts will show up here.</p>
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
    </PageShell>
  );
}
