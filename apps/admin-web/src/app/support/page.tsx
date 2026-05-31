'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { filterBySearch, ListControls } from '../../components/list-controls';
import { PageHeader } from '../../components/ui/page-header';
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
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

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
  const counts = data?.counts ?? { open: 0, inProgress: 0, resolved: 0 };
  const filteredItems = useMemo(() => {
    const rows = data?.items ?? [];
    return filterBySearch(rows.slice(0, limit), search, [
      (t) => t.subject,
      (t) => t.customerEmail,
      (t) => t.status,
      (t) => t.type,
    ]);
  }, [data?.items, search, limit]);
  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Support tickets"
        description={`Open: ${counts.open} · In progress: ${counts.inProgress} · Resolved: ${counts.resolved}`}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'lost_item' ? '' : 'lost_item')}
          className={typeFilter === 'lost_item' ? 'filter-chip-active bg-amber-600 hover:bg-amber-600' : 'filter-chip'}
        >
          Lost items
        </button>
        {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setFilter(s)}
            className={`capitalize ${filter === s ? 'filter-chip-active' : 'filter-chip'}`}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Subject, customer, status…"
        limit={limit}
        onLimitChange={setLimit}
        total={items.length}
        filtered={filteredItems.length}
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading tickets…" />
      </div>

      <div className="mt-6 space-y-2">
        {filteredItems.map((t) => (
          <Link key={t._id} href={`/support/${t._id}`} className="list-row block">
            <div className="flex w-full justify-between gap-4">
              <p className="font-medium text-slate-900">{t.subject}</p>
              <span
                className={
                  t.priority === 'high'
                    ? 'badge-danger shrink-0 capitalize'
                    : t.priority === 'medium'
                      ? 'badge-warning shrink-0 capitalize'
                      : 'badge-neutral shrink-0 capitalize'
                }
              >
                {t.priority}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {t.customerEmail ?? 'No email'} ·{' '}
              <span className="capitalize">{t.status.replace(/_/g, ' ')}</span>
              {t.type === 'lost_item' && ' · Lost item'}
            </p>
          </Link>
        ))}
        {!loading && !error && filteredItems.length === 0 && (
          <p className="text-sm text-muted">No tickets match this filter.</p>
        )}
      </div>
    </div>
  );
}
