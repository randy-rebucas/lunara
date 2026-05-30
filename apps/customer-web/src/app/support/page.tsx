'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { CustomerNav } from '../../components/customer-nav';
import { DataPageStatus } from '../../components/data-page-status';
import { useCustomerQuery } from '../../lib/use-customer-query';

interface Ticket {
  _id: string;
  subject: string;
  status: string;
  type: string;
  updatedAt?: string;
}

export default function SupportTicketsPage() {
  const { api } = useAuthContext();

  const load = useCallback(async () => {
    const res = await api.get<Ticket[]>('/support/tickets');
    return res.data;
  }, [api]);

  const { data: tickets, loading, error } = useCustomerQuery(load, [api]);

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-2xl font-bold">Support tickets</h1>
        <p className="mt-1 text-sm text-slate-500">Track complaints including lost-item reports.</p>

        <div className="mt-4">
          <DataPageStatus loading={loading} error={error} loadingMessage="Loading tickets…" />
        </div>

        <div className="mt-6 space-y-2">
          {(tickets ?? []).map((t) => (
            <Link
              key={t._id}
              href={`/support/${t._id}`}
              className="block rounded-xl border bg-white p-4 hover:border-primary"
            >
              <p className="font-medium">{t.subject}</p>
              <p className="text-sm capitalize text-slate-500">
                {t.type.replace(/_/g, ' ')} · {t.status.replace(/_/g, ' ')}
              </p>
            </Link>
          ))}
          {!loading && !error && (tickets ?? []).length === 0 && (
            <p className="text-slate-500">No tickets yet. Report a missing item from a completed order.</p>
          )}
        </div>
      </main>
    </>
  );
}
