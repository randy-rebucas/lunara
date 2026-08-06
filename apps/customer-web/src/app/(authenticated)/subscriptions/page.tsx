'use client';

import { useCallback, useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageShell } from '../../../components/page-shell';
import { Card, CardBody } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../lib/use-customer-query';

interface SubscriptionRow {
  _id: string;
  bookingType: string;
  frequencyDays: number;
  nextRunAt: string;
  active: boolean;
  lastError?: string;
}

const FREQUENCY_LABELS: Record<number, string> = { 7: 'Weekly', 14: 'Biweekly', 30: 'Monthly' };

export default function SubscriptionsPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<SubscriptionRow[]>('/subscriptions');
    return res.data;
  }, [api]);

  const { data: items, loading, error, reload } = useCustomerQuery(load, [ready, api]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading subscriptions…" />;
  }

  const list = items ?? [];

  async function toggleActive(item: SubscriptionRow) {
    setActioningId(item._id);
    try {
      await api.patch(`/subscriptions/${item._id}`, { active: !item.active });
      await reload();
    } finally {
      setActioningId(null);
    }
  }

  async function cancelSubscription(item: SubscriptionRow) {
    setActioningId(item._id);
    try {
      await api.delete(`/subscriptions/${item._id}`);
      await reload();
    } finally {
      setActioningId(null);
    }
  }

  return (
    <PageShell>
      <PageHeader title="Recurring pickups" description="Manage your subscribed pickup schedules" />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading subscriptions…" />

      <div className="mt-6 list-stack">
        {!loading && !error && list.length === 0 ? (
          <Card>
            <CardBody className="text-center text-muted">
              No recurring pickups yet. After placing an order, you&apos;ll be offered the option to
              repeat it automatically.
            </CardBody>
          </Card>
        ) : (
          list.map((item) => (
            <Card key={item._id}>
              <CardBody>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium capitalize text-slate-900">
                    {item.bookingType.replace(/_/g, ' ')}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      item.active ? 'bg-accent/15 text-accent-dark' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {FREQUENCY_LABELS[item.frequencyDays] ?? `Every ${item.frequencyDays} days`} · Next:{' '}
                  {new Date(item.nextRunAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                </p>
                {item.lastError && (
                  <p className="mt-1 text-sm text-red-600">Last attempt failed: {item.lastError}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={actioningId === item._id}
                    onClick={() => toggleActive(item)}
                  >
                    {item.active ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={actioningId === item._id}
                    onClick={() => cancelSubscription(item)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </PageShell>
  );
}
