'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FleetMap, FleetMapLegend, LEG_COLORS } from './fleet-map';
import { LiveBadge } from '../ui/stat-card';
import { adminFetch } from '../../lib/admin-api';
import { formatOrderId, formatSlugLabel } from '../../lib/format-label';
import { formatPeso } from '../../lib/format-peso';
import { isAdminRealtimeConnected } from '../../lib/admin-realtime';
import { useAdminQuery } from '../../lib/use-admin-query';
import { useAdminOperationsSocket } from '../../lib/use-admin-operations-socket';

const POLL_INTERVAL_MS = 15_000;

// ── Data shapes (mirror /admin/live-tracking) ──────────────────────────────
interface LiveRider {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  hasFix: boolean;
  speed: number | null;
  heading: number | null;
  recordedAt: string | null;
  shiftStatus: 'offline' | 'online' | 'break';
  vehicleType: string;
  plateNumber: string | null;
}

interface LiveBranch {
  id: string;
  name: string;
  code: string;
  city: string;
  lat: number;
  lng: number;
}

interface LiveOrder {
  _id: string;
  status: string;
  leg: 'pickup' | 'delivery';
  bookingType: string;
  total: number;
  branchName: string | null;
  customer: string | null;
  customerPhone: string | null;
  riderUserId: string | null;
  riderName: string | null;
  riderPhone: string | null;
  vehicleType: string | null;
  plateNumber: string | null;
  createdAt: string;
  slaPickupDueAt: string | null;
  timeline: { status: string; timestamp: string }[];
}

interface LiveTrackingData {
  stats: {
    ridersOnline: number;
    totalRiders: number;
    inTransit: number;
    pendingDispatch: number;
    delayedPickups: number;
    completedToday: number;
  };
  riders: LiveRider[];
  branches: LiveBranch[];
  orders: LiveOrder[];
}

type LegFilter = 'all' | 'pickup' | 'delivery';

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(value?: string | Date | null): string {
  if (!value) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function humanizeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function slaLabel(dueAt: string | null): { text: string; tone: string } | null {
  if (!dueAt) return null;
  const diffMin = Math.round((new Date(dueAt).getTime() - Date.now()) / 60_000);
  if (diffMin < 0) return { text: `Overdue ${humanizeMinutes(Math.abs(diffMin))}`, tone: 'badge-danger' };
  if (diffMin <= 15) return { text: `Due in ${humanizeMinutes(diffMin)}`, tone: 'badge-warning' };
  return { text: `Due in ${humanizeMinutes(diffMin)}`, tone: 'badge-neutral' };
}

function statusTone(status: string): string {
  if (status === 'pending' || status === 'pending_dispatch') return 'badge-warning';
  if (status.includes('cancel') || status === 'refunded') return 'badge-danger';
  if (status === 'completed' || status === 'delivered') return 'badge-accent';
  if (status.includes('delivery')) return 'badge-warning';
  return 'badge-primary';
}

// ── Small blocks ───────────────────────────────────────────────────────────
const TILE_TONES = {
  accent: 'bg-accent/[0.04] ring-accent/20 text-accent',
  primary: 'bg-primary/[0.04] ring-primary/15 text-primary',
  secondary: 'bg-secondary/[0.04] ring-secondary/15 text-secondary',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20 text-amber-600',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20 text-rose-600',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20 text-violet-600',
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </>
  );
  const cls = `block rounded-xl p-4 ring-1 ${TILE_TONES[tone]}`;
  return href ? (
    <Link href={href} className={`${cls} transition-all hover:shadow-[var(--shadow-elevated)]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function RailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────
export function LiveTrackingBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);
  const [legFilter, setLegFilter] = useState<LegFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await adminFetch<LiveTrackingData>('/admin/live-tracking');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  useAdminOperationsSocket({
    onDispatchQueueUpdated: () => {
      void reload();
    },
    onDispatcherAlert: () => {
      void reload();
    },
  });

  useEffect(() => {
    const id = setInterval(() => void reload(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reload]);

  useEffect(() => {
    setSocketLive(isAdminRealtimeConnected());
    const id = setInterval(() => setSocketLive(isAdminRealtimeConnected()), 2000);
    return () => clearInterval(id);
  }, [data]);

  const orders = useMemo(() => data?.orders ?? [], [data]);
  const ordersByRider = useMemo(() => {
    const map = new Map<string, LiveOrder>();
    for (const o of orders) {
      if (o.riderUserId && !map.has(o.riderUserId)) map.set(o.riderUserId, o);
    }
    return map;
  }, [orders]);

  const selectedOrder = useMemo(() => {
    if (selectedOrderId) return orders.find((o) => o._id === selectedOrderId) ?? null;
    if (selectedRiderId) return ordersByRider.get(selectedRiderId) ?? null;
    return null;
  }, [orders, ordersByRider, selectedOrderId, selectedRiderId]);

  const selectedRider = useMemo(() => {
    const id = selectedRiderId ?? selectedOrder?.riderUserId ?? null;
    return id ? (data?.riders.find((r) => r.userId === id) ?? null) : null;
  }, [data, selectedRiderId, selectedOrder]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (legFilter !== 'all' && o.leg !== legFilter) return false;
      if (!q) return true;
      return [o._id, o.customer, o.riderName, o.branchName, o.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [orders, legFilter, search]);

  const mappableRiders = useMemo(() => (data?.riders ?? []).filter((r) => r.hasFix), [data]);

  function riderColor(rider: LiveRider): string {
    const active = ordersByRider.get(rider.userId);
    return LEG_COLORS[active?.leg ?? 'idle'];
  }

  function selectOrder(id: string) {
    setSelectedOrderId((prev) => (prev === id ? null : id));
    setSelectedRiderId(null);
  }

  function selectRider(id: string) {
    setSelectedRiderId((prev) => (prev === id ? null : id));
    setSelectedOrderId(null);
  }

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const legCounts = useMemo(
    () => ({
      all: orders.length,
      pickup: orders.filter((o) => o.leg === 'pickup').length,
      delivery: orders.filter((o) => o.leg === 'delivery').length,
    }),
    [orders],
  );

  const s = data?.stats;

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Live tracking</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Real-time view of riders, in-transit orders, and deliveries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {socketLive ? <LiveBadge /> : <span className="badge-neutral">Polling</span>}
            <span className="dc-sublabel tabular-nums" title="Last data refresh">
              Updated {updatedLabel}
            </span>
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={loading}>
              {loading ? 'Syncing…' : 'Refresh'}
            </button>
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
          Loading live tracking…
        </div>
      ) : null}

      {data && s ? (
        <div className="space-y-4">
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Riders online"
              value={String(s.ridersOnline)}
              sub={`of ${s.totalRiders} riders`}
              tone="accent"
              href="/riders"
            />
            <StatTile label="Orders in transit" value={String(s.inTransit)} sub="live legs" tone="primary" />
            <StatTile
              label="Pending dispatch"
              value={String(s.pendingDispatch)}
              sub="awaiting shop"
              tone="secondary"
              href="/dispatch"
            />
            <StatTile
              label="Delayed pickups"
              value={String(s.delayedPickups)}
              sub="past SLA due"
              tone={s.delayedPickups > 0 ? 'rose' : 'violet'}
              href="/control-tower"
            />
            <StatTile label="Completed today" value={String(s.completedToday)} sub="since midnight" tone="amber" />
            <StatTile
              label="GPS fixes"
              value={String(mappableRiders.length)}
              sub="riders reporting location"
              tone="violet"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <div className="min-w-0 space-y-4 xl:col-span-8">
              {/* Map */}
              <section className="dc-panel">
                <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Fleet map</h2>
                    <p className="text-xs text-muted">
                      {mappableRiders.length} rider{mappableRiders.length === 1 ? '' : 's'} with a GPS fix ·{' '}
                      {data.branches.length} shop{data.branches.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <FleetMapLegend />
                </div>

                <FleetMap
                  riders={mappableRiders.map((r) => ({
                    userId: r.userId,
                    name: r.name,
                    lat: r.lat,
                    lng: r.lng,
                    color: riderColor(r),
                    title: `${r.name} — ${timeAgo(r.recordedAt)}`,
                  }))}
                  branches={data.branches}
                  selectedRiderId={selectedRider?.userId ?? null}
                  onSelectRider={selectRider}
                />
              </section>

              {/* Live orders */}
              <section className="dc-panel">
                <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Live orders</h2>
                    <p className="text-xs text-muted">Orders currently with a rider — click a row for details</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        { id: 'all', label: `All (${legCounts.all})` },
                        { id: 'pickup', label: `Pickup (${legCounts.pickup})` },
                        { id: 'delivery', label: `Delivery (${legCounts.delivery})` },
                      ] as { id: LegFilter; label: string }[]
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={legFilter === f.id ? 'filter-chip-active' : 'filter-chip'}
                        onClick={() => setLegFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                    <input
                      type="search"
                      className="input-field w-44 py-1.5 text-sm"
                      placeholder="Search order, rider…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search live orders"
                    />
                  </div>
                </div>

                {filteredOrders.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted">
                    {orders.length === 0
                      ? 'No orders on the road right now.'
                      : 'No orders match the current filter.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <caption className="sr-only">Orders currently in transit</caption>
                      <thead>
                        <tr>
                          <th scope="col">Order</th>
                          <th scope="col">Customer</th>
                          <th scope="col">Rider</th>
                          <th scope="col">Shop</th>
                          <th scope="col">Status</th>
                          <th scope="col">Pickup SLA</th>
                          <th scope="col" className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((o) => {
                          const sla = o.leg === 'pickup' ? slaLabel(o.slaPickupDueAt) : null;
                          const selected = selectedOrder?._id === o._id;
                          return (
                            <tr
                              key={o._id}
                              onClick={() => selectOrder(o._id)}
                              aria-selected={selected}
                              className={`cursor-pointer ${selected ? 'bg-primary/5 hover:bg-primary/5' : ''}`}
                            >
                              <td>
                                <span className="link-primary text-code font-semibold">{formatOrderId(o._id)}</span>
                                <p className="text-xs capitalize text-muted">{formatSlugLabel(o.bookingType)}</p>
                              </td>
                              <td className="max-w-[10rem] truncate text-muted" title={o.customer ?? undefined}>
                                {o.customer ?? '—'}
                              </td>
                              <td className="max-w-[8rem] truncate text-muted">{o.riderName ?? '—'}</td>
                              <td className="max-w-[9rem] truncate text-muted" title={o.branchName ?? undefined}>
                                {o.branchName ?? '—'}
                              </td>
                              <td>
                                <span className={`${statusTone(o.status)} capitalize`}>
                                  {formatSlugLabel(o.status)}
                                </span>
                              </td>
                              <td>{sla ? <span className={sla.tone}>{sla.text}</span> : <span className="text-muted">—</span>}</td>
                              <td className="text-right text-sm font-medium tabular-nums">{formatPeso(o.total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {/* ── Detail rail ── */}
            <div className="space-y-4 xl:col-span-4">
              {!selectedOrder && !selectedRider ? (
                <section className="dc-panel">
                  <div className="dc-panel-header">
                    <h2 className="text-sm font-semibold text-slate-900">Live detail</h2>
                  </div>
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Select an order row or a rider marker to see live details.
                  </p>
                </section>
              ) : null}

              {selectedOrder ? (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Live order detail</h2>
                    <span className={`${statusTone(selectedOrder.status)} capitalize`}>
                      {formatSlugLabel(selectedOrder.status)}
                    </span>
                  </div>
                  <div className="space-y-4 px-5 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/orders/${selectedOrder._id}`} className="link-primary text-code text-sm font-semibold">
                        {formatOrderId(selectedOrder._id)}
                      </Link>
                      <span className="badge-neutral capitalize">{selectedOrder.leg} leg</span>
                    </div>

                    {selectedOrder.timeline.length > 0 ? (
                      <ol className="space-y-0">
                        {selectedOrder.timeline.map((e, i) => {
                          const last = i === selectedOrder.timeline.length - 1;
                          return (
                            <li key={`${e.status}-${e.timestamp}`} className="relative flex gap-3 pb-4 last:pb-0">
                              {!last ? (
                                <span className="absolute left-[5px] top-4 h-full w-px bg-border" aria-hidden />
                              ) : null}
                              <span
                                className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ${
                                  last ? 'bg-primary ring-4 ring-primary/15' : 'bg-slate-300'
                                }`}
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm capitalize ${last ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                  {formatSlugLabel(e.status)}
                                </p>
                                <p className="text-xs tabular-nums text-muted">
                                  {new Date(e.timestamp).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="text-sm text-muted">No status history recorded yet.</p>
                    )}
                  </div>
                </section>
              ) : null}

              {selectedRider || selectedOrder?.riderName ? (
                <section className="dc-panel">
                  <div className="dc-panel-header flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Rider information</h2>
                    {selectedRider ? <LiveBadge /> : null}
                  </div>
                  <div className="space-y-2.5 px-5 py-4">
                    <RailRow label="Name" value={selectedRider?.name ?? selectedOrder?.riderName ?? '—'} />
                    <RailRow
                      label="Vehicle"
                      value={
                        <span className="capitalize">
                          {(selectedRider?.vehicleType ?? selectedOrder?.vehicleType ?? '—') +
                            ((selectedRider?.plateNumber ?? selectedOrder?.plateNumber)
                              ? ` · ${selectedRider?.plateNumber ?? selectedOrder?.plateNumber}`
                              : '')}
                        </span>
                      }
                    />
                    {selectedOrder?.riderPhone ? (
                      <RailRow
                        label="Phone"
                        value={
                          <a href={`tel:${selectedOrder.riderPhone}`} className="link-primary">
                            {selectedOrder.riderPhone}
                          </a>
                        }
                      />
                    ) : null}
                    {selectedRider ? (
                      <>
                        <RailRow label="Shift" value={<span className="capitalize">{selectedRider.shiftStatus}</span>} />
                        <RailRow label="Last GPS fix" value={timeAgo(selectedRider.recordedAt)} />
                        {!ordersByRider.get(selectedRider.userId) ? (
                          <p className="pt-1 text-xs text-muted">No active assignment right now.</p>
                        ) : null}
                      </>
                    ) : null}
                    <div className="pt-2">
                      <Link href="/riders" className="link-primary text-xs font-medium">
                        Open rider management →
                      </Link>
                    </div>
                  </div>
                </section>
              ) : null}

              {selectedOrder ? (
                <>
                  <section className="dc-panel">
                    <div className="dc-panel-header">
                      <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
                    </div>
                    <div className="space-y-2.5 px-5 py-4">
                      <RailRow label="Contact" value={selectedOrder.customer ?? '—'} />
                      {selectedOrder.customerPhone ? (
                        <RailRow
                          label="Phone"
                          value={
                            <a href={`tel:${selectedOrder.customerPhone}`} className="link-primary">
                              {selectedOrder.customerPhone}
                            </a>
                          }
                        />
                      ) : null}
                    </div>
                  </section>

                  <section className="dc-panel">
                    <div className="dc-panel-header">
                      <h2 className="text-sm font-semibold text-slate-900">Order summary</h2>
                    </div>
                    <div className="space-y-2.5 px-5 py-4">
                      <RailRow label="Service" value={<span className="capitalize">{formatSlugLabel(selectedOrder.bookingType)}</span>} />
                      <RailRow label="Laundry shop" value={selectedOrder.branchName ?? '—'} />
                      <RailRow label="Booked" value={timeAgo(selectedOrder.createdAt)} />
                      <RailRow label="Amount" value={<span className="tabular-nums">{formatPeso(selectedOrder.total)}</span>} />
                      <div className="pt-2">
                        <Link href={`/orders/${selectedOrder._id}`} className="link-primary text-xs font-medium">
                          View order details →
                        </Link>
                      </div>
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
