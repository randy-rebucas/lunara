'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { formatCurrency, formatRefundStatus } from '@lunara/utils';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageShell } from '../../components/page-shell';
import { RefundRequestSection } from '../../components/refund-request-section';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { useCustomerQuery } from '../../lib/use-customer-query';
import { formatRefundDate, refundStatusBadgeClass } from '../../lib/refunds';

interface RefundRow {
  _id: string;
  orderId: string;
  status: string;
  stage: string;
  requestedAmount: number;
  approvedAmount?: number;
  updatedAt?: string;
  createdAt?: string;
}

export default function RefundsListPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<RefundRow[]>('/refunds');
    return res.data;
  }, [api]);

  const { data: items, loading, error, reload } = useCustomerQuery(load, [ready, api]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading refunds…" />;
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  const list = items ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Refunds"
        description="Request a refund for wallet or online payments, or track requests through wallet payout. Cash on pickup or delivery is not refundable here."
      />

      <RefundRequestSection existingRefunds={list} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Your refund requests</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || refreshing}
          onClick={() => void handleRefresh()}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading refunds…" />

      <div className="mt-4 list-stack">
        {list.map((r) => (
          <Link key={r._id} href={`/refunds/${r._id}`}>
            <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">Order …{r.orderId.slice(-6)}</p>
                  <p className="mt-1 text-sm text-muted">
                    Requested {formatCurrency(r.requestedAmount)}
                    {r.approvedAmount != null && r.approvedAmount !== r.requestedAmount
                      ? ` · Approved ${formatCurrency(r.approvedAmount)}`
                      : ''}
                    {r.updatedAt || r.createdAt
                      ? ` · Updated ${formatRefundDate(r.updatedAt ?? r.createdAt)}`
                      : ''}
                  </p>
                </div>
                <span className={`shrink-0 capitalize ${refundStatusBadgeClass(r.status)}`}>
                  {formatRefundStatus(r.status)}
                </span>
              </CardBody>
            </Card>
          </Link>
        ))}
        {!loading && !error && list.length === 0 && (
          <Card className="bg-surface-muted/50">
            <CardBody className="text-sm text-muted">
              No refund requests yet. Use the section above to start a request for a paid order,
              or open any order and choose Request refund.
            </CardBody>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
