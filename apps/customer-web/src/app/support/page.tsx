'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageShell } from '../../components/page-shell';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { useCustomerQuery } from '../../lib/use-customer-query';
import { useAuthContext } from '@lunara/hooks/auth-provider';

interface Ticket {
  _id: string;
  subject: string;
  status: string;
  type: string;
  updatedAt?: string;
}

export default function SupportTicketsPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });

  const load = useCallback(async () => {
    const res = await api.get<Ticket[]>('/support/tickets');
    return res.data;
  }, [api]);

  const { data: tickets, loading, error } = useCustomerQuery(load, [ready, api]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading support…" />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Support tickets"
        description="Track complaints including lost-item reports."
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading tickets…" />

      <div className="mt-6 list-stack">
        {(tickets ?? []).map((t) => (
          <Link key={t._id} href={`/support/${t._id}`}>
            <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
              <CardBody>
                <p className="font-medium text-slate-900">{t.subject}</p>
                <p className="mt-1 text-sm capitalize text-muted">
                  {t.type.replace(/_/g, ' ')} · {t.status.replace(/_/g, ' ')}
                </p>
              </CardBody>
            </Card>
          </Link>
        ))}
        {!loading && !error && (tickets ?? []).length === 0 && (
          <Card>
            <CardBody className="text-muted">
              No tickets yet. Report a missing item from a completed order.
            </CardBody>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
