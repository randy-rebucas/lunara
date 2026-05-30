'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface Ticket {
  _id: string;
  subject: string;
  status: string;
  priority: string;
  type?: string;
  customerEmail?: string;
  updatedAt?: string;
}

export default function SupportTicketsPage() {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    if (typeFilter) params.set('type', typeFilter);
    const q = params.toString() ? `?${params}` : '';
    return adminFetch<{ items: Ticket[]; counts: { open: number; inProgress: number; resolved: number } }>(
      `/admin/tickets${q}`,
    );
  }, [filter, typeFilter]);

  const { data, loading, error } = useAdminQuery(load, [filter, typeFilter]);
  const items = data?.items ?? [];
  const counts = data?.counts ?? { open: 0, inProgress: 0, resolved: 0 };

  return (
    <div>
      <h2 className="text-2xl font-bold">Support tickets</h2>
      <p className="mt-1 text-sm text-slate-500">
        Open: {counts.open} · In progress: {counts.inProgress} · Resolved: {counts.resolved}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'lost_item' ? '' : 'lost_item')}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            typeFilter === 'lost_item' ? 'bg-amber-600 text-white' : 'border bg-white'
          }`}
        >
          Lost items
        </button>
        {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
              filter === s ? 'bg-indigo-600 text-white' : 'border bg-white'
            }`}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading tickets…" />
      </div>

      <div className="mt-6 space-y-2">
        {items.map((t) => (
          <Link
            key={t._id}
            href={`/support/${t._id}`}
            className="block rounded-xl border bg-white p-4 shadow-sm hover:border-indigo-300"
          >
            <div className="flex justify-between gap-4">
              <p className="font-medium">{t.subject}</p>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs capitalize ${
                  t.priority === 'high'
                    ? 'bg-red-100 text-red-800'
                    : t.priority === 'medium'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100'
                }`}
              >
                {t.priority}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {t.customerEmail ?? 'No email'} ·{' '}
              <span className="capitalize">{t.status.replace(/_/g, ' ')}</span>
              {t.type === 'lost_item' && ' · Lost item'}
            </p>
          </Link>
        ))}
        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-500">No tickets match this filter.</p>
        )}
      </div>
    </div>
  );
}
