'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { filterBySearch, ListControls } from '../list-controls';
import { LiveBadge } from '../ui/stat-card';
import { adminFetch } from '../../lib/admin-api';
import { formatOrderId, formatSlugLabel } from '../../lib/format-label';
import { formatPeso } from '../../lib/format-peso';
import { isAdminRealtimeConnected } from '../../lib/admin-realtime';
import { useAdminQuery } from '../../lib/use-admin-query';
import { useAdminOperationsSocket } from '../../lib/use-admin-operations-socket';

interface OrderRow {
  _id: string;
  status: string;
  bookingType: string;
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  customerEmail?: string;
  customerPhone?: string;
  branchName?: string;
  riderName?: string | null;
  bagSizeLabel?: string | null;
  estimatedWeightKg?: number | null;
  scheduledPickupAt?: string | null;
  scheduledDeliveryAt?: string | null;
  slaStatus?: string;
  slaLabel?: string;
  operationsConflict?: boolean;
  createdAt?: string;
  dispatchStatus?: string;
  partnerAcceptedAt?: string | null;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReceiptCode?: string;
  paymentPaidAt?: string;
  cashTiming?: string;
  requiresDeliveryApproval?: boolean;
  deliveryDistanceKm?: number;
}

type PipelineState = 'nominal' | 'attention' | 'critical';
type TabId = 'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

const STATUS_GROUPS: Record<Exclude<TabId, 'all'>, string[]> = {
  scheduled: ['pending', 'pending_dispatch'],
  in_progress: [
    'shop_assigned',
    'confirmed',
    'rider_assigned_pickup',
    'rider_assigned',
    'picked_up',
    'in_transit_to_shop',
    'received_at_shop',
    'received',
    'sorting',
    'washing',
    'drying',
    'folding',
    'ironing',
    'quality_check',
    'ready_for_delivery',
    'customer_pickup',
    'rider_assigned_delivery',
    'out_for_delivery',
  ],
  completed: ['delivered', 'completed'],
  cancelled: ['cancelled', 'refunded'],
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All orders' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function groupCount(counts: Record<string, number>, group: Exclude<TabId, 'all'>): number {
  return STATUS_GROUPS[group].reduce((sum, s) => sum + (counts[s] ?? 0), 0);
}

function derivePipelineState(
  pendingDispatch: number,
  active: number,
  conflicts: number,
  slaBreaches: number,
): PipelineState {
  if (conflicts > 0 || slaBreaches > 0) return 'critical';
  if (pendingDispatch > 0 || active > 0) return 'attention';
  return 'nominal';
}

const pipelineCopy: Record<
  PipelineState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Pipeline nominal',
    detail: 'No dispatch backlog or SLA exceptions in the loaded ledger.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Pipeline active',
    detail: 'Orders in-flight or awaiting shop / rider dispatch.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Exceptions flagged',
    detail: 'Operational conflicts or SLA breaches need review.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function statusBadgeClass(status: string) {
  if (status === 'pending' || status === 'pending_dispatch') return 'badge-warning';
  if (status === 'completed' || status === 'delivered') return 'badge-accent';
  if (status.includes('cancel') || status === 'refunded') return 'badge-danger';
  if (status.includes('rider') || status.includes('pickup') || status.includes('delivery')) {
    return 'badge-primary';
  }
  return 'badge-secondary';
}

function paymentBadgeClass(status?: string) {
  if (status === 'paid') return 'badge-accent';
  if (status === 'pending') return 'badge-warning';
  if (status === 'failed') return 'badge-danger';
  return 'badge-neutral';
}

function slaBadgeClass(status?: string) {
  if (status === 'breached') return 'badge-danger';
  if (status === 'warning') return 'badge-warning';
  return 'badge-neutral';
}

const AWAITING_PARTNER_STATUSES = ['shop_assigned', 'confirmed', 'ready_for_delivery'];

function isAwaitingPartnerAccept(o: OrderRow): boolean {
  return (
    !!o.branchName &&
    o.dispatchStatus === 'dispatched' &&
    !o.partnerAcceptedAt &&
    AWAITING_PARTNER_STATUSES.includes(o.status)
  );
}

function formatShortDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function paymentLabel(o: OrderRow): string {
  if (!o.paymentMethod) return '—';
  if (o.paymentMethod === 'cash') {
    return `Cash${o.cashTiming ? ` (${o.cashTiming})` : ''}`;
  }
  return formatSlugLabel(o.paymentMethod);
}

// ── Stat tiles ─────────────────────────────────────────────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg p-4 text-left ring-1 transition-all hover:shadow-[var(--shadow-elevated)] ${TILE_TONES[tone]} ${
        active ? 'ring-2 ring-primary/40' : ''
      }`}
    >
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </button>
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

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 px-5 py-4 first:border-0">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────
export function OrdersBoard() {
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Deep-link support: /orders?status=completed preselects the tab; ?search= prefills the search box
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('status');
    if (s && TABS.some((t) => t.id === s)) setTab(s as TabId);
    const q = params.get('search');
    if (q) setSearch(q);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('status', STATUS_GROUPS[tab].join(','));
    params.set('limit', String(limit));
    const data = await adminFetch<{ items: OrderRow[]; statusCounts: Record<string, number> }>(
      `/admin/orders?${params}`,
    );
    setLastUpdated(new Date());
    return data;
  }, [tab, limit]);

  const { data, loading, error, reload } = useAdminQuery(load, [tab, limit]);

  const [approvingDelivery, setApprovingDelivery] = useState(false);
  const approveDelivery = useCallback(
    async (orderId: string) => {
      setApprovingDelivery(true);
      try {
        await adminFetch(`/admin/dispatch/orders/${orderId}/approve-delivery`, { method: 'POST' });
        await reload();
      } finally {
        setApprovingDelivery(false);
      }
    },
    [reload],
  );

  useAdminOperationsSocket({
    onDispatchQueueUpdated: () => {
      void reload();
    },
    onDispatcherAlert: () => {
      void reload();
    },
  });

  useEffect(() => {
    setSocketLive(isAdminRealtimeConnected());
    const id = setInterval(() => setSocketLive(isAdminRealtimeConnected()), 2000);
    return () => clearInterval(id);
  }, [data]);

  const statusCounts = useMemo(() => data?.statusCounts ?? {}, [data?.statusCounts]);
  const items = useMemo(() => data?.items ?? [], [data?.items]);

  const totals = useMemo(() => {
    const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
    const completed = groupCount(statusCounts, 'completed');
    const inProgress = groupCount(statusCounts, 'in_progress');
    const scheduled = groupCount(statusCounts, 'scheduled');
    const cancelled = groupCount(statusCounts, 'cancelled');
    const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}% of total` : undefined);
    return { total, completed, inProgress, scheduled, cancelled, pct };
  }, [statusCounts]);

  const filteredItems = useMemo(
    () =>
      filterBySearch(items, search, [
        (o) => o._id,
        (o) => o.customerEmail,
        (o) => o.customerPhone,
        (o) => o.branchName,
        (o) => o.riderName ?? undefined,
        (o) => o.status,
      ]),
    [items, search],
  );

  const selected = useMemo(
    () => (selectedId ? (items.find((o) => o._id === selectedId) ?? null) : null),
    [items, selectedId],
  );

  const conflictsInLoad = items.filter((o) => o.operationsConflict).length;
  const slaBreachesInLoad = items.filter((o) => o.slaStatus === 'breached').length;
  const pipelineState = derivePipelineState(
    statusCounts.pending_dispatch ?? 0,
    totals.inProgress,
    conflictsInLoad,
    slaBreachesInLoad,
  );
  const copy = pipelineCopy[pipelineState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  function selectTabAndClear(next: TabId) {
    setTab(next);
    setSelectedId(null);
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Pipeline</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Orders
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Manage all customer orders and track their progress.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {socketLive ? <LiveBadge /> : <span className="badge-neutral">Polling</span>}
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
            <Link href="/live-tracking" className="btn-outline btn-sm">
              Live tracking
            </Link>
            <Link href="/dispatch" className="btn-primary btn-sm">
              Dispatch
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
          Loading orders…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {/* Pipeline banner */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {(statusCounts.pending_dispatch ?? 0) > 0 ? (
              <Link href="/dispatch" className="badge-warning px-3 py-1 text-xs font-semibold">
                {statusCounts.pending_dispatch} pending dispatch
              </Link>
            ) : null}
            {conflictsInLoad > 0 ? (
              <Link href="/control-tower" className="badge-danger px-3 py-1 text-xs font-semibold">
                {conflictsInLoad} conflict{conflictsInLoad === 1 ? '' : 's'}
              </Link>
            ) : null}
            {slaBreachesInLoad > 0 ? (
              <Link href="/control-tower" className="badge-danger px-3 py-1 text-xs font-semibold">
                {slaBreachesInLoad} SLA breach{slaBreachesInLoad === 1 ? '' : 'es'}
              </Link>
            ) : null}
          </div>

          {/* Stat tiles — click to jump to the matching tab */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label="Total orders"
              value={totals.total.toLocaleString()}
              sub="all time"
              tone="primary"
              onClick={() => selectTabAndClear('all')}
              active={tab === 'all'}
            />
            <StatTile
              label="Completed"
              value={totals.completed.toLocaleString()}
              sub={totals.pct(totals.completed)}
              tone="accent"
              onClick={() => selectTabAndClear('completed')}
              active={tab === 'completed'}
            />
            <StatTile
              label="In progress"
              value={totals.inProgress.toLocaleString()}
              sub={totals.pct(totals.inProgress)}
              tone="secondary"
              onClick={() => selectTabAndClear('in_progress')}
              active={tab === 'in_progress'}
            />
            <StatTile
              label="Scheduled"
              value={totals.scheduled.toLocaleString()}
              sub={totals.pct(totals.scheduled)}
              tone="amber"
              onClick={() => selectTabAndClear('scheduled')}
              active={tab === 'scheduled'}
            />
            <StatTile
              label="Cancelled"
              value={totals.cancelled.toLocaleString()}
              sub={totals.pct(totals.cancelled)}
              tone="rose"
              onClick={() => selectTabAndClear('cancelled')}
              active={tab === 'cancelled'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <section className="dc-panel min-w-0 xl:col-span-8">
              {/* Tabs */}
              <div
                className="overflow-x-auto overflow-y-hidden border-b border-border/60 px-3"
                role="tablist"
                aria-label="Order status groups"
              >
                <div className="flex min-w-max gap-1">
                  {TABS.map((t) => {
                    const count =
                      t.id === 'all' ? totals.total : groupCount(statusCounts, t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => selectTabAndClear(t.id)}
                        className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                          tab === t.id
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted hover:text-slate-900'
                        }`}
                      >
                        {t.label}
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-slate-600">
                          {count.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 pb-1">
                <ListControls
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Order ID, customer, phone, shop, rider…"
                  limit={limit}
                  onLimitChange={setLimit}
                  limitOptions={[25, 50, 100, 200]}
                  total={items.length}
                  filtered={filteredItems.length}
                />
              </div>

              {filteredItems.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">No orders found</p>
                  <p className="mt-1 text-sm text-muted">
                    {search || tab !== 'all'
                      ? 'Try a different search or switch tabs.'
                      : 'Orders will appear as customers book.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[680px]">
                    <caption className="sr-only">Platform orders</caption>
                    <thead>
                      <tr>
                        <th scope="col">Order</th>
                        <th scope="col">Customer</th>
                        <th scope="col">Service</th>
                        <th scope="col">Schedule</th>
                        <th scope="col" className="text-right">Amount</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((o) => {
                        const isSelected = selectedId === o._id;
                        return (
                          <tr
                            key={o._id}
                            onClick={() => setSelectedId((prev) => (prev === o._id ? null : o._id))}
                            aria-selected={isSelected}
                            className={`cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/5' : ''}`}
                          >
                            <td>
                              <span className="link-primary text-code font-semibold">
                                {formatOrderId(o._id)}
                              </span>
                              <p className="whitespace-nowrap text-xs text-muted">
                                {formatShortDateTime(o.createdAt)}
                              </p>
                            </td>
                            <td className="max-w-[11rem]">
                              <p className="truncate text-sm text-slate-900" title={o.customerEmail}>
                                {o.customerEmail ?? '—'}
                              </p>
                              <p className="truncate text-xs text-muted">{o.customerPhone ?? ''}</p>
                            </td>
                            <td>
                              <p className="whitespace-nowrap text-sm capitalize text-slate-900">
                                {formatSlugLabel(o.bookingType)}
                              </p>
                              <p className="whitespace-nowrap text-xs text-muted">
                                {o.bagSizeLabel ??
                                  (o.estimatedWeightKg ? `${o.estimatedWeightKg} kg` : '')}
                              </p>
                            </td>
                            <td>
                              <p className="whitespace-nowrap text-xs text-slate-700">
                                ↑ {formatShortDateTime(o.scheduledPickupAt)}
                              </p>
                              <p className="whitespace-nowrap text-xs text-muted">
                                ↓ {formatShortDateTime(o.scheduledDeliveryAt)}
                              </p>
                            </td>
                            <td className="text-right">
                              <p className="text-sm font-medium tabular-nums">{formatPeso(o.total)}</p>
                              {o.paymentStatus ? (
                                <span className={`${paymentBadgeClass(o.paymentStatus)} whitespace-nowrap capitalize`}>
                                  {formatSlugLabel(o.paymentStatus)}
                                </span>
                              ) : null}
                            </td>
                            <td>
                              <div className="flex flex-col items-start gap-1">
                                <span className={`${statusBadgeClass(o.status)} whitespace-nowrap capitalize`}>
                                  {formatSlugLabel(o.status)}
                                </span>
                                {o.operationsConflict ? (
                                  <span className="badge-danger">Conflict</span>
                                ) : null}
                                {o.requiresDeliveryApproval ? (
                                  <span
                                    className="badge-warning"
                                    title={`Delivery distance (${o.deliveryDistanceKm?.toFixed(1) ?? '?'}km) exceeds the shop's service radius — needs admin approval`}
                                  >
                                    Needs approval
                                  </span>
                                ) : null}
                                {isAwaitingPartnerAccept(o) ? (
                                  <span
                                    className="badge-neutral"
                                    title="Partner must accept the order in the partner portal before a rider can be assigned"
                                  >
                                    Awaiting partner
                                  </span>
                                ) : null}
                                {o.slaStatus === 'breached' || o.slaStatus === 'warning' ? (
                                  <span className={`${slaBadgeClass(o.slaStatus)} whitespace-nowrap`}>
                                    {o.slaLabel}
                                  </span>
                                ) : null}
                              </div>
                            </td>
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
                    <h2 className="text-sm font-semibold text-slate-900">Order detail</h2>
                  </div>
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Select an order row to preview its details here.
                  </p>
                </section>
              ) : (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href={`/orders/${selected._id}`}
                        className="link-primary text-code text-sm font-semibold"
                      >
                        {formatOrderId(selected._id)}
                      </Link>
                      <span className={`${statusBadgeClass(selected.status)} capitalize`}>
                        {formatSlugLabel(selected.status)}
                      </span>
                      {isAwaitingPartnerAccept(selected) ? (
                        <span className="badge-neutral" title="Partner must accept the order in the partner portal before a rider can be assigned">
                          Awaiting partner
                        </span>
                      ) : null}
                      {selected.requiresDeliveryApproval ? (
                        <span className="badge-warning">Needs approval</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      aria-label="Close detail panel"
                      onClick={() => setSelectedId(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <RailSection title="Customer">
                    <RailRow label="Email" value={selected.customerEmail ?? '—'} />
                    <RailRow
                      label="Phone"
                      value={
                        selected.customerPhone ? (
                          <a href={`tel:${selected.customerPhone}`} className="link-primary">
                            {selected.customerPhone}
                          </a>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </RailSection>

                  <RailSection title="Order information">
                    <RailRow
                      label="Service"
                      value={<span className="capitalize">{formatSlugLabel(selected.bookingType)}</span>}
                    />
                    {selected.bagSizeLabel || selected.estimatedWeightKg ? (
                      <RailRow
                        label="Load"
                        value={
                          selected.bagSizeLabel ??
                          (selected.estimatedWeightKg ? `${selected.estimatedWeightKg} kg` : '—')
                        }
                      />
                    ) : null}
                    <RailRow label="Laundry shop" value={selected.branchName ?? '—'} />
                    <RailRow label="Rider" value={selected.riderName ?? '—'} />
                    <RailRow label="Pickup" value={formatShortDateTime(selected.scheduledPickupAt)} />
                    <RailRow label="Delivery" value={formatShortDateTime(selected.scheduledDeliveryAt)} />
                    {selected.slaLabel ? (
                      <RailRow
                        label="Pickup SLA"
                        value={<span className={slaBadgeClass(selected.slaStatus)}>{selected.slaLabel}</span>}
                      />
                    ) : null}
                    {selected.operationsConflict ? (
                      <RailRow label="Flags" value={<span className="badge-danger">Conflict</span>} />
                    ) : null}
                    {selected.deliveryDistanceKm != null ? (
                      <RailRow label="Delivery distance" value={`${selected.deliveryDistanceKm.toFixed(1)} km`} />
                    ) : null}
                  </RailSection>

                  {selected.requiresDeliveryApproval ? (
                    <RailSection title="Delivery approval">
                      <p className="px-0 pb-2 text-xs text-muted">
                        This address is beyond the assigned shop&apos;s normal service radius. Dispatch
                        is on hold until an admin approves the delivery distance.
                      </p>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={approvingDelivery}
                        onClick={() => void approveDelivery(selected._id)}
                      >
                        {approvingDelivery ? 'Approving…' : 'Approve delivery & dispatch'}
                      </button>
                    </RailSection>
                  ) : null}

                  <RailSection title="Summary">
                    {selected.subtotal != null ? (
                      <RailRow label="Subtotal" value={<span className="tabular-nums">{formatPeso(selected.subtotal)}</span>} />
                    ) : null}
                    {selected.deliveryFee != null ? (
                      <RailRow label="Delivery fee" value={<span className="tabular-nums">{formatPeso(selected.deliveryFee)}</span>} />
                    ) : null}
                    {selected.discount ? (
                      <RailRow label="Discount" value={<span className="tabular-nums">−{formatPeso(selected.discount)}</span>} />
                    ) : null}
                    <div className="border-t border-border/60 pt-2">
                      <RailRow
                        label="Total"
                        value={
                          <span className="text-base font-bold tabular-nums">{formatPeso(selected.total)}</span>
                        }
                      />
                    </div>
                  </RailSection>

                  <RailSection title="Payment">
                    <RailRow label="Method" value={<span className="capitalize">{paymentLabel(selected)}</span>} />
                    <RailRow
                      label="Status"
                      value={
                        <span className={`${paymentBadgeClass(selected.paymentStatus)} capitalize`}>
                          {selected.paymentStatus ? formatSlugLabel(selected.paymentStatus) : '—'}
                        </span>
                      }
                    />
                    {selected.paymentPaidAt ? (
                      <RailRow label="Paid at" value={formatShortDateTime(selected.paymentPaidAt)} />
                    ) : null}
                    {selected.paymentReceiptCode ? (
                      <RailRow
                        label="Reference"
                        value={<span className="text-code">{selected.paymentReceiptCode}</span>}
                      />
                    ) : null}
                  </RailSection>

                  <div className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-4">
                    <Link href={`/orders/${selected._id}`} className="btn-primary btn-sm flex-1 text-center">
                      Open order ops
                    </Link>
                    <Link href="/live-tracking" className="btn-outline btn-sm flex-1 text-center">
                      View tracking
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
