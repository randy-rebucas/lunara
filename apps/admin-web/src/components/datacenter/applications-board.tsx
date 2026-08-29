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

/** Normalized row so both application types share the table, rail, and filters. */
interface ApplicationRow {
  id: string;
  type: 'rider' | 'partner';
  name: string;
  subName?: string;
  email: string;
  phone: string;
  status: string;
  createdAt?: string;
  reviewHref: string;
}

type TypeTab = 'all' | 'rider' | 'partner';

const STATUSES = ['pending', 'reviewed', 'approved', 'rejected'] as const;

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

function timeAgo(value?: string): string {
  if (!value) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes < 1 ? 'just now' : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Small blocks ───────────────────────────────────────────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  onClick?: () => void;
  active?: boolean;
}) {
  const cls = `rounded-lg p-4 text-left ring-1 transition-all ${TILE_TONES[tone]} ${
    active ? 'ring-2 ring-primary/40' : ''
  }`;
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:shadow-[var(--shadow-elevated)]`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 px-5 py-4 first:border-0">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 break-all text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────
export function ApplicationsBoard() {
  const [typeTab, setTypeTab] = useState<TypeTab>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Both lists are small — load unfiltered once and slice client-side so tiles and
  // tab counts stay accurate across types.
  const load = useCallback(async () => {
    const [riderApps, partnerApps] = await Promise.all([
      adminFetch<RiderApplication[]>('/rider-applications'),
      adminFetch<PartnerApplication[]>('/partner-applications'),
    ]);
    const rows: ApplicationRow[] = [
      ...riderApps.map((a) => ({
        id: a._id,
        type: 'rider' as const,
        name: `${a.firstName} ${a.lastName}`.trim() || a.email,
        email: a.email,
        phone: a.phone,
        status: a.status,
        createdAt: a.createdAt,
        reviewHref: `/applications/rider/${a._id}`,
      })),
      ...partnerApps.map((a) => ({
        id: a._id,
        type: 'partner' as const,
        name: a.businessName,
        subName: a.ownerFullName,
        email: a.email,
        phone: a.phone,
        status: a.status,
        createdAt: a.createdAt,
        reviewHref: `/applications/partner/${a._id}`,
      })),
    ];
    rows.sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );
    return rows;
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);
  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<string, number>;
    let riders = 0;
    let partners = 0;
    let thisMonth = 0;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (r.type === 'rider') riders += 1;
      else partners += 1;
      if (r.createdAt && new Date(r.createdAt) >= startOfMonth) thisMonth += 1;
    }
    return { byStatus, riders, partners, thisMonth };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (typeTab !== 'all') list = list.filter((r) => r.type === typeTab);
    if (statusFilter) list = list.filter((r) => r.status === statusFilter);
    return filterBySearch(list, search, [
      (r) => r.name,
      (r) => r.subName,
      (r) => r.email,
      (r) => r.phone,
    ]);
  }, [rows, typeTab, statusFilter, search]);

  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  const selected = useMemo(
    () => (selectedId ? (rows.find((r) => r.id === selectedId) ?? null) : null),
    [rows, selectedId],
  );

  // `rows` is sorted newest-first; the review queue highlights the longest-waiting
  // (oldest) pending applications, so take from the tail and reverse to oldest-first.
  const pendingQueue = useMemo(
    () => rows.filter((r) => r.status === 'pending').slice(-8).reverse(),
    [rows],
  );

  const TYPE_TABS: { id: TypeTab; label: string; count: number }[] = [
    { id: 'all', label: 'All applications', count: rows.length },
    { id: 'rider', label: 'Riders', count: counts.riders },
    { id: 'partner', label: 'Partners', count: counts.partners },
  ];

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">People</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Applications
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Review rider and partner applications, their submitted documents, and approve or
              reject them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href="/riders" className="btn-outline btn-sm">
              Riders
            </Link>
            <Link href="/partners/new" className="btn-primary btn-sm">
              Add partner directly
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading applications…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {/* Stat tiles — click to filter by status */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Total applications"
              value={rows.length.toLocaleString()}
              sub={`${counts.riders} riders · ${counts.partners} partners`}
              tone="primary"
              onClick={() => setStatusFilter('')}
              active={statusFilter === ''}
            />
            <StatTile
              label="Pending review"
              value={String(counts.byStatus.pending ?? 0)}
              sub="awaiting first look"
              tone={counts.byStatus.pending > 0 ? 'amber' : 'violet'}
              onClick={() => setStatusFilter('pending')}
              active={statusFilter === 'pending'}
            />
            <StatTile
              label="Reviewed"
              value={String(counts.byStatus.reviewed ?? 0)}
              sub="in progress"
              tone="secondary"
              onClick={() => setStatusFilter('reviewed')}
              active={statusFilter === 'reviewed'}
            />
            <StatTile
              label="Approved"
              value={String(counts.byStatus.approved ?? 0)}
              tone="accent"
              onClick={() => setStatusFilter('approved')}
              active={statusFilter === 'approved'}
            />
            <StatTile
              label="Rejected"
              value={String(counts.byStatus.rejected ?? 0)}
              tone="rose"
              onClick={() => setStatusFilter('rejected')}
              active={statusFilter === 'rejected'}
            />
            <StatTile
              label="New this month"
              value={String(counts.thisMonth)}
              sub="submissions"
              tone="violet"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            {/* ── Applications table ── */}
            <section className="dc-panel min-w-0 xl:col-span-8">
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="Application type"
              >
                <div className="flex min-w-max gap-1">
                  {TYPE_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={typeTab === t.id}
                      onClick={() => setTypeTab(t.id)}
                      className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                        typeTab === t.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-slate-600">
                        {t.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 pb-1">
                <ListControls
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Name, business, email, phone…"
                  limit={limit}
                  onLimitChange={setLimit}
                  total={filtered.length}
                  filtered={visible.length}
                  filterValue={statusFilter}
                  onFilterChange={setStatusFilter}
                  filterOptions={[
                    { value: '', label: 'All statuses', count: rows.length },
                    ...STATUSES.map((s) => ({
                      value: s,
                      label: formatSlugLabel(s).replace(/^./, (c) => c.toUpperCase()),
                      count: counts.byStatus[s] ?? 0,
                    })),
                  ]}
                  filterLabel="Status"
                />
              </div>

              {!loading && visible.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">No applications match</p>
                  <p className="mt-1 text-sm text-muted">
                    {search || statusFilter || typeTab !== 'all'
                      ? 'Try another filter or search term.'
                      : 'No applications have been submitted yet.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[620px]">
                    <caption className="sr-only">Application ledger</caption>
                    <thead>
                      <tr>
                        <th scope="col">Applicant</th>
                        <th scope="col">Type</th>
                        <th scope="col">Contact</th>
                        <th scope="col">Submitted</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((a) => {
                        const isSelected = selectedId === a.id;
                        return (
                          <tr
                            key={a.id}
                            onClick={() => setSelectedId((prev) => (prev === a.id ? null : a.id))}
                            aria-selected={isSelected}
                            className={`cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/5' : ''}`}
                          >
                            <td>
                              <div className="flex items-center gap-3">
                                <span
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                                    a.type === 'rider'
                                      ? 'bg-amber-500/10 text-amber-600'
                                      : 'bg-blue-500/10 text-blue-600'
                                  }`}
                                  aria-hidden
                                >
                                  {(a.name[0] ?? 'A').toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                  <p className="max-w-[13rem] truncate text-sm font-medium text-slate-900" title={a.name}>
                                    {a.name}
                                  </p>
                                  {a.subName ? (
                                    <p className="max-w-[13rem] truncate text-xs text-muted" title={a.subName}>
                                      {a.subName}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                                  a.type === 'rider'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {a.type}
                              </span>
                            </td>
                            <td className="max-w-[12rem]">
                              <p className="truncate text-sm text-slate-900" title={a.email}>
                                {a.email}
                              </p>
                              <p className="text-xs text-muted">{a.phone}</p>
                            </td>
                            <td className="whitespace-nowrap text-sm text-muted" title={formatDate(a.createdAt)}>
                              {timeAgo(a.createdAt)}
                            </td>
                            <td>
                              <span className={`${statusBadgeClass(a.status)} capitalize`}>{a.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Rail ── */}
            <div className="space-y-4 xl:col-span-4">
              {selected ? (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Application preview</h2>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      aria-label="Close preview"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center gap-3 px-5 py-4">
                    <span
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold ${
                        selected.type === 'rider'
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-blue-500/10 text-blue-600'
                      }`}
                      aria-hidden
                    >
                      {(selected.name[0] ?? 'A').toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900" title={selected.name}>
                        {selected.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                            selected.type === 'rider'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {selected.type}
                        </span>
                        <span className={`${statusBadgeClass(selected.status)} capitalize`}>
                          {selected.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <RailSection title="Details">
                    {selected.subName ? <RailRow label="Owner" value={selected.subName} /> : null}
                    <RailRow label="Email" value={selected.email} />
                    <RailRow
                      label="Phone"
                      value={
                        <a href={`tel:${selected.phone}`} className="link-primary">
                          {selected.phone}
                        </a>
                      }
                    />
                    <RailRow label="Submitted" value={formatDate(selected.createdAt)} />
                  </RailSection>

                  <div className="border-t border-border/60 px-5 py-4">
                    <Link href={selected.reviewHref} className="btn-primary btn-sm block w-full text-center">
                      Open full review
                    </Link>
                    <p className="mt-2 text-xs text-muted">
                      Documents, requirements, and approve/reject actions live on the review page.
                    </p>
                  </div>
                </section>
              ) : (
                <section className="dc-panel">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">Review queue</h2>
                    <p className="text-xs text-muted">Oldest pending applications first</p>
                  </div>
                  {pendingQueue.length === 0 ? (
                    <p className="dc-panel-empty text-sm text-muted">
                      No pending applications — the queue is clear.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {pendingQueue.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              a.type === 'rider'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-blue-500/10 text-blue-600'
                            }`}
                            aria-hidden
                          >
                            {(a.name[0] ?? 'A').toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">{a.name}</p>
                            <p className="text-xs capitalize text-muted">
                              {a.type} · {timeAgo(a.createdAt)}
                            </p>
                          </div>
                          <Link href={a.reviewHref} className="link-primary shrink-0 text-xs font-medium">
                            Review →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
