'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageShell } from '../../../components/page-shell';
import { SupportCreateSection } from '../../../components/support-create-section';
import { Card, CardBody } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../lib/use-customer-query';
import {
  formatTicketDate,
  formatTicketStatus,
  formatTicketType,
  ticketStatusBadgeClass,
} from '../../../lib/support-tickets';

interface Ticket {
  _id: string;
  subject: string;
  status: string;
  type: string;
  updatedAt?: string;
  createdAt?: string;
}

export default function SupportTicketsPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<Ticket[]>('/support/tickets');
    return res.data;
  }, [api]);

  const { data: tickets, loading, error, reload } = useCustomerQuery(load, [ready, api]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading support…" />;
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  const list = tickets ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Support"
        description="Submit a request or track open tickets. General questions, missing items, and pickup-area requests all appear here."
      />

      <SupportCreateSection onTicketCreated={() => void reload()} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Your tickets</h2>
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

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading tickets…" />

      <div className="mt-4 list-stack">
        {list.map((t) => (
          <Link key={t._id} href={`/support/${t._id}`}>
            <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
              <CardBody className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{t.subject}</p>
                  <p className="mt-1 text-sm text-muted">
                    {formatTicketType(t.type)}
                    {t.updatedAt || t.createdAt
                      ? ` · Updated ${formatTicketDate(t.updatedAt ?? t.createdAt)}`
                      : ''}
                  </p>
                </div>
                <span className={`shrink-0 capitalize ${ticketStatusBadgeClass(t.status)}`}>
                  {formatTicketStatus(t.status)}
                </span>
              </CardBody>
            </Card>
          </Link>
        ))}
        {!loading && !error && list.length === 0 && (
          <Card className="bg-surface-muted/50">
            <CardBody className="text-sm text-muted">
              No tickets yet. Use the form above to submit a general question, request pickup in
              your area, or report a missing item from a delivered order.
            </CardBody>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
