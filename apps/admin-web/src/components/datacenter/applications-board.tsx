'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { adminFetch } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';
import { useAdminQuery } from '../../lib/use-admin-query';

interface RiderApplication {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  createdAt?: string;
}

interface PartnerApplication {
  _id: string;
  businessName: string;
  ownerFullName: string;
  email: string;
  phone: string;
  status: string;
  createdAt?: string;
}

type Tab = 'rider' | 'partner';

const FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'badge-accent';
  if (status === 'rejected') return 'badge-danger';
  if (status === 'reviewed') return 'badge-primary';
  return 'badge-warning';
}

function formatDate(at?: string) {
  if (!at) return '—';
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ApplicationsBoard() {
  const [tab, setTab] = useState<Tab>('rider');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    const q = params.toString() ? `?${params}` : '';
    if (tab === 'rider') {
      return adminFetch<RiderApplication[]>(`/rider-applications${q}`);
    }
    return adminFetch<PartnerApplication[]>(`/partner-applications${q}`);
  }, [tab, filter]);

  const { data, loading, error, reload } = useAdminQuery(load, [tab, filter]);

  const items = useMemo(() => data ?? [], [data]);

  const filteredItems = useMemo(() => {
    const searched =
      tab === 'rider'
        ? filterBySearch(items as RiderApplication[], search, [
            (a) => `${a.firstName} ${a.lastName}`,
            (a) => a.email,
            (a) => a.phone,
          ])
        : filterBySearch(items as PartnerApplication[], search, [
            (a) => a.businessName,
            (a) => a.ownerFullName,
            (a) => a.email,
            (a) => a.phone,
          ]);
    return searched.slice(0, limit);
  }, [items, search, limit, tab]);

  function switchTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    setFilter('');
    setSearch('');
  }

  return (
    <div>
      <header className="mb-5">
        <p className="dc-eyebrow">People</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Applications</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
          Review rider and partner applications, their submitted documents, and approve or reject them.
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={tab === 'rider' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
          onClick={() => switchTab('rider')}
        >
          Rider applications
        </button>
        <button
          type="button"
          className={tab === 'partner' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
          onClick={() => switchTab('partner')}
        >
          Partner applications
        </button>
      </div>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={tab === 'rider' ? 'Name, email, phone…' : 'Business, owner, email, phone…'}
        limit={limit}
        onLimitChange={setLimit}
        total={items.length}
        filtered={filteredItems.length}
        filterValue={filter}
        onFilterChange={setFilter}
        filterOptions={FILTER_OPTIONS}
        filterLabel="Status"
      />

      <section className="dc-panel mt-3">
        <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {tab === 'rider' ? 'Rider' : 'Partner'} applications
            </h2>
            <p className="text-xs text-muted">
              Showing {filteredItems.length} of {items.length}
              {filter ? ` · ${formatSlugLabel(filter)}` : ''}
            </p>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Syncing…' : 'Sync'}
          </button>
        </div>

        {!loading && filteredItems.length === 0 ? (
          <div className="dc-panel-empty">
            <p className="font-medium text-slate-900">No applications match</p>
            <p className="mt-1 text-sm text-muted">
              {search || filter ? 'Try another filter or search term.' : 'No applications have been submitted yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <caption className="sr-only">{tab === 'rider' ? 'Rider' : 'Partner'} application ledger</caption>
              <thead>
                <tr>
                  <th scope="col">{tab === 'rider' ? 'Name' : 'Business'}</th>
                  {tab === 'partner' && <th scope="col">Owner</th>}
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tab === 'rider'
                  ? (filteredItems as RiderApplication[]).map((a) => (
                      <tr key={a._id}>
                        <td className="font-medium">
                          <Link href={`/applications/rider/${a._id}`} className="link-primary">
                            {a.firstName} {a.lastName}
                          </Link>
                        </td>
                        <td className="text-muted">{a.email}</td>
                        <td className="text-muted">{a.phone}</td>
                        <td className="text-muted">{formatDate(a.createdAt)}</td>
                        <td>
                          <span className={`${statusBadgeClass(a.status)} capitalize`}>{a.status}</span>
                        </td>
                        <td>
                          <Link href={`/applications/rider/${a._id}`} className="link-primary text-xs font-medium">
                            Review →
                          </Link>
                        </td>
                      </tr>
                    ))
                  : (filteredItems as PartnerApplication[]).map((a) => (
                      <tr key={a._id}>
                        <td className="font-medium">
                          <Link href={`/applications/partner/${a._id}`} className="link-primary">
                            {a.businessName}
                          </Link>
                        </td>
                        <td className="text-muted">{a.ownerFullName}</td>
                        <td className="text-muted">{a.email}</td>
                        <td className="text-muted">{a.phone}</td>
                        <td className="text-muted">{formatDate(a.createdAt)}</td>
                        <td>
                          <span className={`${statusBadgeClass(a.status)} capitalize`}>{a.status}</span>
                        </td>
                        <td>
                          <Link href={`/applications/partner/${a._id}`} className="link-primary text-xs font-medium">
                            Review →
                          </Link>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
