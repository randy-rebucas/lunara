'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { adminFetch } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';
import { useAdminQuery } from '../../lib/use-admin-query';

interface Ticket {
  _id: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  type?: string;
  customerEmail?: string;
  orderId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TicketCounts {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  lostItem: number;
  total: number;
}

type SupportState = 'nominal' | 'attention' | 'critical';
type StatusTab = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';

function deriveSupportState(counts: TicketCounts, highPriorityOpen: number): SupportState {
  if (counts.open >= 10 || highPriorityOpen >= 3) return 'critical';
  if (counts.open > 0 || counts.inProgress > 0) return 'attention';
  return 'nominal';
}

const supportCopy: Record<
  SupportState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Support queue clear',
    detail: 'No open tickets waiting for admin response.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Tickets need review',
    detail: 'Open or in-progress tickets are waiting in the queue.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Support backlog elevated',
    detail: 'High volume of open tickets or urgent priority items.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function priorityBadgeClass(priority: string) {
  if (priority === 'high') return 'badge-danger';
  if (priority === 'medium') return 'badge-warning';
  return 'badge-neutral';
}

function statusBadgeClass(status: string) {
  if (status === 'open') return 'badge-warning';
  if (status === 'in_progress') return 'badge-primary';
  if (status === 'resolved') return 'badge-accent';
  return 'badge-neutral';
}

function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
      <span className="min-w-0 text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function SupportBoard() {
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusTab !== 'all') params.set('status', statusTab);
    if (typeFilter) params.set('type', typeFilter);
    const q = params.toString() ? `?${params}` : '';
    const data = await adminFetch<{ items: Ticket[]; counts: TicketCounts }>(`/admin/tickets${q}`);
    setLastUpdated(new Date());
    return data;
  }, [statusTab, typeFilter]);

  const { data, loading, error, reload } = useAdminQuery(load, [statusTab, typeFilter]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 120_000);
    return () => window.clearInterval(id);
  }, [reload]);

  const counts = useMemo(
    () => data?.counts ?? { open: 0, inProgress: 0, resolved: 0, closed: 0, lostItem: 0, total: 0 },
    [data?.counts],
  );
  const items = useMemo(() => data?.items ?? [], [data?.items]);

  const filteredItems = useMemo(() => {
    const searched = filterBySearch(items, search, [
      (t) => t.subject,
      (t) => t.customerEmail,
      (t) => t.status,
      (t) => t.type,
      (t) => t.priority,
    ]);
    return searched.slice(0, limit);
  }, [items, search, limit]);

  const highPriorityOpen = useMemo(
    () =>
      items.filter(
        (t) => t.priority === 'high' && (t.status === 'open' || t.status === 'in_progress'),
      ).length,
    [items],
  );

  const selected = useMemo(
    () => (selectedId ? (items.find((t) => t._id === selectedId) ?? null) : null),
    [items, selectedId],
  );

  const supportState = deriveSupportState(counts, highPriorityOpen);
  const copy = supportCopy[supportState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  const STATUS_TABS: { id: StatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'All tickets', count: counts.total },
    { id: 'open', label: 'Open', count: counts.open },
    { id: 'in_progress', label: 'In progress', count: counts.inProgress },
    { id: 'resolved', label: 'Resolved', count: counts.resolved },
    { id: 'closed', label: 'Closed', count: counts.closed },
  ];

  function selectTab(next: StatusTab) {
    setStatusTab(next);
    setSelectedId(null);
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Customer success</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Support
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Ticket queue — general inquiries and lost-item investigations with order evidence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="dc-sublabel tabular-nums" title="Last data refresh">
              Updated {updatedLabel}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
            <Link href="/refunds" className="btn-outline btn-sm">
              Refunds
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
          Loading tickets…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {/* State banner */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {highPriorityOpen > 0 ? (
              <span className="badge-danger px-3 py-1 text-xs font-semibold">
                {highPriorityOpen} high priority
              </span>
            ) : null}
            {counts.lostItem > 0 ? (
              <button
                type="button"
                className="badge-primary px-3 py-1 text-xs font-semibold"
                onClick={() => setTypeFilter(typeFilter === 'lost_item' ? '' : 'lost_item')}
              >
                {counts.lostItem} lost item{counts.lostItem === 1 ? '' : 's'}
              </button>
            ) : null}
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label="Total tickets"
              value={counts.total.toLocaleString()}
              sub="all time"
              tone="primary"
              onClick={() => selectTab('all')}
              active={statusTab === 'all'}
            />
            <StatTile
              label="Open"
              value={String(counts.open)}
              sub="awaiting response"
              tone={counts.open > 0 ? 'amber' : 'accent'}
              onClick={() => selectTab('open')}
              active={statusTab === 'open'}
            />
            <StatTile
              label="In progress"
              value={String(counts.inProgress)}
              tone="secondary"
              onClick={() => selectTab('in_progress')}
              active={statusTab === 'in_progress'}
            />
            <StatTile
              label="Resolved"
              value={String(counts.resolved)}
              tone="accent"
              onClick={() => selectTab('resolved')}
              active={statusTab === 'resolved'}
            />
            <StatTile
              label="Lost items"
              value={String(counts.lostItem)}
              sub="all statuses"
              tone={counts.lostItem > 0 ? 'rose' : 'violet'}
              onClick={() => setTypeFilter(typeFilter === 'lost_item' ? '' : 'lost_item')}
              active={typeFilter === 'lost_item'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            {/* ── Ticket list ── */}
            <section className="dc-panel min-w-0 xl:col-span-8">
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="Ticket status"
              >
                <div className="flex min-w-max gap-1">
                  {STATUS_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={statusTab === t.id}
                      onClick={() => selectTab(t.id)}
                      className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                        statusTab === t.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-slate-600">
                        {t.count.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 pb-1">
                <ListControls
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Subject, customer, status…"
                  limit={limit}
                  onLimitChange={setLimit}
                  total={items.length}
                  filtered={filteredItems.length}
                  filterValue={typeFilter}
                  onFilterChange={setTypeFilter}
                  filterOptions={[
                    { value: '', label: 'All types' },
                    { value: 'lost_item', label: 'Lost items' },
                    { value: 'general', label: 'General' },
                    { value: 'area_coverage', label: 'Area coverage' },
                  ]}
                  filterLabel="Type"
                />
              </div>

              {filteredItems.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">No tickets match</p>
                  <p className="mt-1 text-sm text-muted">
                    {search || statusTab !== 'all' || typeFilter
                      ? 'Try another filter or search term.'
                      : 'The queue is empty — customers open tickets from the app.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[680px]">
                    <caption className="sr-only">Support ticket ledger</caption>
                    <thead>
                      <tr>
                        <th scope="col">Subject</th>
                        <th scope="col">Type</th>
                        <th scope="col">Priority</th>
                        <th scope="col">Status</th>
                        <th scope="col">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((t) => {
                        const isSelected = selectedId === t._id;
                        const isUrgent =
                          t.priority === 'high' && t.status !== 'resolved' && t.status !== 'closed';
                        return (
                          <tr
                            key={t._id}
                            onClick={() => setSelectedId((prev) => (prev === t._id ? null : t._id))}
                            aria-selected={isSelected}
                            className={
                              isSelected
                                ? 'bg-primary/5 hover:bg-primary/5'
                                : isUrgent
                                  ? 'bg-red-50/40'
                                  : t.type === 'lost_item' && t.status === 'open'
                                    ? 'bg-amber-50/40'
                                    : ''
                            }
                          >
                            <td className="max-w-[16rem]">
                              <p className="truncate text-sm font-medium text-slate-900" title={t.subject}>
                                {t.subject}
                              </p>
                              <p className="max-w-[16rem] truncate text-xs text-muted" title={t.customerEmail}>
                                {t.customerEmail ?? '—'}
                              </p>
                            </td>
                            <td>
                              {t.type === 'lost_item' ? (
                                <span className="badge-primary">Lost item</span>
                              ) : (
                                <span className="capitalize text-muted">
                                  {t.type ? formatSlugLabel(t.type) : 'General'}
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`${priorityBadgeClass(t.priority)} capitalize`}>
                                {t.priority}
                              </span>
                            </td>
                            <td>
                              <span className={`${statusBadgeClass(t.status)} capitalize`}>
                                {formatSlugLabel(t.status)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap text-xs text-muted">{timeAgo(t.updatedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Detail rail ── */}
            <div className="xl:col-span-4">
              {!selected ? (
                <section className="dc-panel">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">Ticket detail</h2>
                  </div>
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Select a ticket row to preview it here.
                  </p>
                </section>
              ) : (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900" title={selected.subject}>
                        {selected.subject}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`${statusBadgeClass(selected.status)} capitalize`}>
                          {formatSlugLabel(selected.status)}
                        </span>
                        <span className={`${priorityBadgeClass(selected.priority)} capitalize`}>
                          {selected.priority}
                        </span>
                        {selected.type === 'lost_item' ? (
                          <span className="badge-primary">Lost item</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm shrink-0"
                      aria-label="Close detail panel"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  {selected.description ? (
                    <RailSection title="Description">
                      <p className="text-sm leading-relaxed text-slate-700">{selected.description}</p>
                    </RailSection>
                  ) : null}

                  <RailSection title="Customer">
                    <RailRow label="Email" value={selected.customerEmail ?? '—'} />
                    {selected.orderId ? (
                      <RailRow
                        label="Order"
                        value={
                          <Link href={`/orders/${selected.orderId}`} className="link-primary text-code">
                            {selected.orderId.slice(-8)}
                          </Link>
                        }
                      />
                    ) : null}
                  </RailSection>

                  <RailSection title="Timeline">
                    <RailRow label="Created" value={formatDateTime(selected.createdAt)} />
                    <RailRow label="Last updated" value={formatDateTime(selected.updatedAt)} />
                  </RailSection>

                  <div className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
                    <Link href={`/support/${selected._id}`} className="btn-primary btn-sm flex-1 text-center">
                      Open full ticket
                    </Link>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
