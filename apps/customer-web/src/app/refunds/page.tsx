'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { formatRefundStatus } from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageShell } from '../../components/page-shell';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { useCustomerQuery } from '../../lib/use-customer-query';

interface RefundRow {
  _id: string;
  orderId: string;
  status: string;
  stage: string;
  requestedAmount: number;
  approvedAmount?: number;
  updatedAt?: string;
}

export default function RefundsListPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });

  const load = useCallback(async () => {
    const res = await api.get<RefundRow[]>('/refunds');
    return res.data;
  }, [api]);

  const { data: items, loading, error } = useCustomerQuery(load, [ready, api]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading refunds…" />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Refund requests"
        description="Track status from submission through payout."
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading refunds…" />

      <div className="mt-6 list-stack">
        {(items ?? []).map((r) => (
          <Link key={r._id} href={`/refunds/${r._id}`}>
            <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
              <CardBody>
                <p className="font-medium text-slate-900">Order …{r.orderId.slice(-6)}</p>
                <p className="mt-1 text-sm capitalize text-muted">
                  {formatRefundStatus(r.status)} · ₱{r.requestedAmount}
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
        {!loading && !error && (items ?? []).length === 0 && (
          <Card>
            <CardBody className="text-muted">No refund requests yet.</CardBody>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
