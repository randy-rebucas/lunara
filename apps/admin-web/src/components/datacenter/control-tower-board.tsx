'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CompareLineChart, DonutChart } from './dash-charts';
import type { DonutSegment } from './dash-charts';
import { FleetMap, FleetMapLegend, LEG_COLORS } from './fleet-map';
import { LiveBadge } from '../ui/stat-card';
import { StatTile } from '../ui/stat-tile';
import { adminFetch } from '../../lib/admin-api';
import { formatOrderId, formatSlugLabel } from '../../lib/format-label';
import { formatPeso } from '../../lib/format-peso';
import { isAdminRealtimeConnected } from '../../lib/admin-realtime';
import { useAdminQuery } from '../../lib/use-admin-query';
import { useAdminOperationsSocket } from '../../lib/use-admin-operations-socket';

const MAP_POLL_INTERVAL_MS = 15_000;

// ── Data shapes ────────────────────────────────────────────────────────────
interface ControlTowerData {
  counts: {
    pendingDispatch: number;
    awaitingPartnerAccept: number;
    awaitingPickupRider: number;
    awaitingDeliveryRider: number;
    slaBreaches: number;
    conflicts: number;
    openTickets: number;
  };
  pulse: {
    today: {
      orders: number;
      ordersDelta: number | null;
      completed: number;
      completedDelta: number | null;
      revenue: number;
      revenueDelta: number | null;
      avgOrderValue: number;
      inProgressNow: number;
    };
    ridersOnline: number;
    totalRiders: number;
    totalBranches: number;
    hourly: { hour: number; today: number; yesterday: number; revenueToday: number }[];
    statusBreakdownToday: { key: string; label: string; count: number }[];
    topShopsToday: { name: string; orders: number; revenue: number }[];
    topServicesToday: { service: string; count: number }[];
    areasToday: { area: string; orders: number }[];
    pickupPerformance: {
      measured: number;
      onTime: number;
      late: number;
      onTimeRate: number | null;
      avgDelayMin: number;
    };
  };
  watchlist: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
    branchName?: string;
    dispatchStatus?: string;
    operationsConflict?: boolean;
    sla: { status: string; label: string };
  }[];
}

interface LiveMapData {
  riders: {
    userId: string;
    name: string;
    lat: number;
    lng: number;
    hasFix: boolean;
    recordedAt: string | null;
  }[];
  branches: { id: string; name: string; code: string; city: string; lat: number; lng: number }[];
  orders: { riderUserId: string | null; leg: 'pickup' | 'delivery' }[];
}

type OpsState = 'nominal' | 'attention' | 'critical';

function deriveOpsState(counts: ControlTowerData['counts']): OpsState {
  if (counts.slaBreaches > 0 || counts.conflicts > 0) return 'critical';
  if (
    counts.pendingDispatch > 0 ||
    counts.awaitingPartnerAccept > 0 ||
    counts.awaitingPickupRider > 0 ||
    counts.awaitingDeliveryRider > 0
  ) {
    return 'attention';
  }
  return 'nominal';
}

const opsCopy: Record<OpsState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal: {
    label: 'Logistics nominal',
    detail: 'No SLA breaches or flagged conflicts in the watchlist.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Action required',
    detail: 'Orders waiting on shop assignment, partner accept, or rider dispatch.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Critical exceptions',
    detail: 'SLA breaches or operational conflicts need immediate review.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function slaBadgeClass(status: string) {
  if (status === 'breached') return 'badge-danger';
  if (status === 'warning') return 'badge-warning';
  return 'badge-neutral';
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#f59e0b',
  in_progress: '#8b5cf6',
  out_for_delivery: '#f97316',
  completed: 'var(--color-accent)',
  cancelled: '#ef4444',
};

const SERVICE_COLORS = ['var(--color-primary)', 'var(--color-accent)', '#f59e0b', '#8b5cf6', '#64748b'];

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

function hourLabel(hour: number): string {
  const h = hour % 12 || 12;
  return `${h}${hour < 12 ? 'a' : 'p'}`;
}

// ── Small blocks ───────────────────────────────────────────────────────────
function PanelHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {sub ? <p className="text-xs text-muted">{sub}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="link-primary text-xs font-medium">
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

interface AlertItem {
  tone: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  detail: string;
  href: string;
}

const ALERT_DOT: Record<AlertItem['tone'], string> = {
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-primary',
  success: 'bg-emerald-500',
};

function buildAlerts(counts: ControlTowerData['counts'], pulse: ControlTowerData['pulse']): AlertItem[] {
  const alerts: AlertItem[] = [];
  if (counts.slaBreaches > 0) {
    alerts.push({
      tone: 'danger',
      title: `${counts.slaBreaches} pickup SLA breach${counts.slaBreaches === 1 ? '' : 'es'}`,
      detail: 'Pickups past their promised window',
      href: '/orders',
    });
  }
  if (counts.conflicts > 0) {
    alerts.push({
      tone: 'danger',
      title: `${counts.conflicts} operational conflict${counts.conflicts === 1 ? '' : 's'}`,
      detail: 'Orders flagged for manual resolution',
      href: '/orders',
    });
  }
  if (counts.pendingDispatch > 0) {
    alerts.push({
      tone: 'warning',
      title: `${counts.pendingDispatch} awaiting shop assignment`,
      detail: 'Paid orders in the dispatch queue',
      href: '/dispatch',
    });
  }
  if (counts.awaitingPartnerAccept > 0) {
    alerts.push({
      tone: 'warning',
      title: `${counts.awaitingPartnerAccept} awaiting partner accept`,
      detail: 'Dispatched but not yet confirmed by the shop',
      href: '/orders',
    });
  }
  if (counts.awaitingPickupRider > 0) {
    alerts.push({
      tone: 'info',
      title: `${counts.awaitingPickupRider} need a pickup rider`,
      detail: 'Shop accepted, no rider confirmed',
      href: '/dispatch',
    });
  }
  if (counts.awaitingDeliveryRider > 0) {
    alerts.push({
      tone: 'info',
      title: `${counts.awaitingDeliveryRider} need a delivery rider`,
      detail: 'Ready for delivery, no rider assigned',
      href: '/dispatch',
    });
  }
  if (counts.openTickets > 0) {
    alerts.push({
      tone: 'info',
      title: `${counts.openTickets} open support ticket${counts.openTickets === 1 ? '' : 's'}`,
      detail: 'Customer and rider issues awaiting reply',
      href: '/support',
    });
  }
  if (pulse.totalRiders > 0 && pulse.ridersOnline / pulse.totalRiders < 0.3) {
    alerts.push({
      tone: 'warning',
      title: 'Low rider availability',
      detail: `Only ${pulse.ridersOnline} of ${pulse.totalRiders} riders online`,
      href: '/riders',
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      tone: 'success',
      title: 'All systems operational',
      detail: 'No queues, breaches, or conflicts right now',
      href: '/',
    });
  }
  return alerts.slice(0, 6);
}

// ── Board ──────────────────────────────────────────────────────────────────
export function ControlTowerBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);

  const load = useCallback(async () => {
    const data = await adminFetch<ControlTowerData>('/admin/control-tower');
    setLastUpdated(new Date());
    return data;
  }, []);
  const { data, loading, error, reload } = useAdminQuery(load, []);

  const loadMap = useCallback(() => adminFetch<LiveMapData>('/admin/live-tracking'), []);
  const mapQuery = useAdminQuery(loadMap, []);

  useAdminOperationsSocket({
    onDispatchQueueUpdated: () => {
      void reload();
      void mapQuery.reload();
    },
    onDispatcherAlert: () => {
      void reload();
      void mapQuery.reload();
    },
  });

  useEffect(() => {
    const id = setInterval(() => void mapQuery.reload(), MAP_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [mapQuery.reload]);

  useEffect(() => {
    setSocketLive(isAdminRealtimeConnected());
    const id = setInterval(() => setSocketLive(isAdminRealtimeConnected()), 2000);
    return () => clearInterval(id);
  }, [data]);

  const ops = data ? deriveOpsState(data.counts) : 'nominal';
  const copy = opsCopy[ops];
  const pulse = data?.pulse;

  const alerts = useMemo(
    () => (data && pulse ? buildAlerts(data.counts, pulse) : []),
    [data, pulse],
  );

  const hourLabels = useMemo(() => Array.from({ length: 24 }, (_, i) => hourLabel(i)), []);

  const statusDonut: DonutSegment[] = (pulse?.statusBreakdownToday ?? []).map((s) => ({
    key: s.key,
    label: s.label,
    count: s.count,
    color: STATUS_COLORS[s.key] ?? '#94a3b8',
  }));

  const serviceDonut: DonutSegment[] = (pulse?.topServicesToday ?? []).slice(0, 5).map((s, i) => ({
    key: s.service,
    label: formatSlugLabel(s.service),
    count: s.count,
    color: SERVICE_COLORS[i % SERVICE_COLORS.length],
  }));

  const mapRiders = useMemo(() => {
    const riders = (mapQuery.data?.riders ?? []).filter((r) => r.hasFix);
    const legByRider = new Map(
      (mapQuery.data?.orders ?? [])
        .filter((o) => o.riderUserId)
        .map((o) => [o.riderUserId as string, o.leg]),
    );
    return riders.map((r) => ({
      userId: r.userId,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      color: LEG_COLORS[legByRider.get(r.userId) ?? 'idle'],
      title: `${r.name} — ${timeAgo(r.recordedAt)}`,
    }));
  }, [mapQuery.data]);

  const maxArea = Math.max(1, ...(pulse?.areasToday ?? []).map((a) => a.orders));

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Logistics</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Control tower
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Real-time overview of operations across the entire network.
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
          Loading control tower…
        </div>
      ) : null}

      {data && pulse ? (
        <div className="space-y-4">
          {/* Ops state banner */}
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {data.counts.slaBreaches > 0 ? (
              <Link href="/orders" className="badge-danger px-3 py-1 text-xs font-semibold">
                {data.counts.slaBreaches} SLA
              </Link>
            ) : null}
            {data.counts.conflicts > 0 ? (
              <Link href="/orders" className="badge-danger px-3 py-1 text-xs font-semibold">
                {data.counts.conflicts} conflicts
              </Link>
            ) : null}
            {data.counts.pendingDispatch > 0 ? (
              <Link href="/dispatch" className="badge-warning px-3 py-1 text-xs font-semibold">
                {data.counts.pendingDispatch} dispatch
              </Link>
            ) : null}
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Orders today"
              value={pulse.today.orders.toLocaleString()}
              delta={pulse.today.ordersDelta}
              sub="vs yesterday"
              tone="primary"
              href="/orders"
            />
            <StatTile
              label="In progress now"
              value={pulse.today.inProgressNow.toLocaleString()}
              sub="active pipeline"
              tone="secondary"
              href="/orders?status=in_progress"
            />
            <StatTile
              label="Completed today"
              value={pulse.today.completed.toLocaleString()}
              delta={pulse.today.completedDelta}
              sub="vs yesterday"
              tone="accent"
              href="/orders?status=completed"
            />
            <StatTile
              label="Active riders"
              value={`${pulse.ridersOnline} / ${pulse.totalRiders}`}
              sub={
                pulse.totalRiders > 0
                  ? `${Math.round((pulse.ridersOnline / pulse.totalRiders) * 100)}% on duty`
                  : undefined
              }
              tone="rose"
              href="/riders"
            />
            <StatTile
              label="Laundry shops"
              value={pulse.totalBranches.toLocaleString()}
              sub="on the network"
              tone="violet"
              href="/partners"
            />
            <StatTile
              label="Pickup on-time"
              value={pulse.pickupPerformance.onTimeRate != null ? `${pulse.pickupPerformance.onTimeRate}%` : '—'}
              sub={
                pulse.pickupPerformance.measured > 0
                  ? `${pulse.pickupPerformance.measured} measured today`
                  : 'no pickups measured today'
              }
              tone="amber"
            />
          </div>

          {/* Map / status donut / alerts */}
          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <section className="dc-panel min-w-0 xl:col-span-6">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Live operations map</h2>
                  <p className="text-xs text-muted">
                    {mapRiders.length} rider{mapRiders.length === 1 ? '' : 's'} with GPS ·{' '}
                    {pulse?.totalBranches ?? 0} shops
                  </p>
                </div>
                <Link href="/live-tracking" className="link-primary text-xs font-medium">
                  Open live tracking →
                </Link>
              </div>
              <FleetMap
                riders={mapRiders}
                branches={mapQuery.data?.branches ?? []}
                heightClass="h-[22rem]"
              />
              <div className="border-t border-border/60 px-4 py-2.5">
                <FleetMapLegend />
              </div>
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="Order status" sub="Orders created today" />
              <div className="dc-panel-body">
                <DonutChart
                  segments={statusDonut}
                  centerValue={pulse.today.orders.toLocaleString()}
                  centerLabel="Today"
                />
                <ul className="mt-3 space-y-1.5">
                  {statusDonut.map((s) => (
                    <li key={s.key} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <span className="flex-1 text-muted">{s.label}</span>
                      <span className="font-semibold tabular-nums text-slate-900">{s.count}</span>
                      <span className="w-12 text-right tabular-nums text-muted">
                        {pulse.today.orders > 0
                          ? `${((s.count / pulse.today.orders) * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="System alerts" action={{ href: '/control-tower', label: 'Refresh' }} />
              <ul className="divide-y divide-border/40">
                {alerts.map((a) => (
                  <li key={a.title}>
                    <Link
                      href={a.href}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-primary/5"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ALERT_DOT[a.tone]}`} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">{a.title}</span>
                        <span className="block text-xs text-muted">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Trends / top shops / pickup performance */}
          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <section className="dc-panel min-w-0 xl:col-span-6">
              <PanelHeader title="Orders over time" sub="Created per hour — today vs yesterday" />
              <div className="dc-panel-body">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <span className="inline-block h-0.5 w-4 rounded-full bg-primary" aria-hidden /> Today
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <span
                      className="inline-block h-0.5 w-4 rounded-full"
                      style={{ backgroundColor: '#94a3b8' }}
                      aria-hidden
                    />{' '}
                    Yesterday
                  </span>
                </div>
                <div className="mt-2">
                  <CompareLineChart
                    labels={hourLabels}
                    series={[
                      {
                        label: 'Today',
                        color: 'var(--color-primary)',
                        values: pulse.hourly.map((h) => h.today),
                      },
                      {
                        label: 'Yesterday',
                        color: '#94a3b8',
                        dashed: true,
                        values: pulse.hourly.map((h) => h.yesterday),
                      },
                    ]}
                    ariaLabel="Orders created per hour, today versus yesterday"
                  />
                </div>
              </div>
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="Top shops" sub="Completed revenue today" action={{ href: '/partners', label: 'View all' }} />
              {pulse.topShopsToday.length === 0 ? (
                <p className="dc-panel-empty text-sm text-muted">No completed orders yet today.</p>
              ) : (
                <ol className="divide-y divide-border/40">
                  {pulse.topShopsToday.map((s, i) => (
                    <li key={s.name} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                        <p className="text-xs text-muted">
                          {s.orders} order{s.orders === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatPeso(s.revenue, true)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="Pickup performance" sub="Collected today vs SLA" />
              <div className="dc-panel-body">
                {pulse.pickupPerformance.measured === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">
                    No pickups measured against an SLA yet today.
                  </p>
                ) : (
                  <>
                    <DonutChart
                      segments={[
                        {
                          key: 'ontime',
                          label: 'On time',
                          count: pulse.pickupPerformance.onTime,
                          color: 'var(--color-accent)',
                        },
                        { key: 'late', label: 'Late', count: pulse.pickupPerformance.late, color: '#ef4444' },
                      ]}
                      centerValue={`${pulse.pickupPerformance.onTimeRate ?? 0}%`}
                      centerLabel="On time"
                    />
                    <dl className="mt-3 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted">Pickups measured</dt>
                        <dd className="font-semibold tabular-nums text-slate-900">
                          {pulse.pickupPerformance.measured}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted">Late pickups</dt>
                        <dd className={`font-semibold tabular-nums ${pulse.pickupPerformance.late > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {pulse.pickupPerformance.late}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted">Avg delay when late</dt>
                        <dd className="font-semibold tabular-nums text-slate-900">
                          {pulse.pickupPerformance.avgDelayMin}m
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Areas / revenue / services */}
          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <section className="dc-panel xl:col-span-4">
              <PanelHeader title="Order volume by area" sub="Orders created today by branch city" />
              {pulse.areasToday.length === 0 ? (
                <p className="dc-panel-empty text-sm text-muted">No orders yet today.</p>
              ) : (
                <ul className="space-y-3 px-4 py-4">
                  {pulse.areasToday.map((a) => (
                    <li key={a.area}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-slate-900">{a.area}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{a.orders}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-primary/80"
                          style={{ width: `${(a.orders / maxArea) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dc-panel min-w-0 xl:col-span-5">
              <PanelHeader title="Revenue overview" sub="Completed order revenue today" action={{ href: '/revenue', label: 'Details' }} />
              <div className="dc-panel-body">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="dc-label">Gross revenue</p>
                    <p className="dc-value-sm mt-0.5">{formatPeso(pulse.today.revenue, true)}</p>
                    {pulse.today.revenueDelta != null ? (
                      <span
                        className={`dc-metric-trend ${
                          pulse.today.revenueDelta >= 0 ? 'dc-metric-trend-up' : 'dc-metric-trend-down'
                        }`}
                      >
                        {pulse.today.revenueDelta >= 0 ? '▲' : '▼'} {Math.abs(pulse.today.revenueDelta)}%
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="dc-label">Orders completed</p>
                    <p className="dc-value-sm mt-0.5">{pulse.today.completed}</p>
                  </div>
                  <div>
                    <p className="dc-label">Avg order value</p>
                    <p className="dc-value-sm mt-0.5">{formatPeso(pulse.today.avgOrderValue, true)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <CompareLineChart
                    labels={hourLabels}
                    series={[
                      {
                        label: 'Revenue',
                        color: 'var(--color-accent)',
                        values: pulse.hourly.map((h) => h.revenueToday),
                      },
                    ]}
                    formatValue={(v) => formatPeso(v, true)}
                    ariaLabel="Completed order revenue per hour today"
                  />
                </div>
              </div>
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="Top services" sub="Orders created today" action={{ href: '/services', label: 'View all' }} />
              <div className="dc-panel-body">
                {serviceDonut.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">No orders yet today.</p>
                ) : (
                  <>
                    <DonutChart
                      segments={serviceDonut}
                      centerValue={pulse.today.orders.toLocaleString()}
                      centerLabel="Today"
                    />
                    <ul className="mt-3 space-y-1.5">
                      {serviceDonut.map((s) => (
                        <li key={s.key} className="flex items-center gap-2 text-xs">
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: s.color }}
                            aria-hidden
                          />
                          <span className="flex-1 capitalize text-muted">{s.label}</span>
                          <span className="font-semibold tabular-nums text-slate-900">{s.count}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Watchlist */}
          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Priority watchlist</h2>
                <p className="text-xs text-muted">
                  {data.watchlist.length} order{data.watchlist.length === 1 ? '' : 's'} needing attention
                </p>
              </div>
              <Link href="/orders" className="link-primary text-xs font-medium">
                Full ledger →
              </Link>
            </div>

            {data.watchlist.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                No priority items — pipeline is clear.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Priority operations watchlist</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Service</th>
                      <th scope="col">Shop</th>
                      <th scope="col">Pipeline</th>
                      <th scope="col">Flags</th>
                      <th scope="col">SLA</th>
                      <th scope="col" className="text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.watchlist.map((o) => (
                      <tr key={o._id}>
                        <td>
                          <Link href={`/orders/${o._id}`} className="link-primary text-code font-semibold">
                            {formatOrderId(o._id)}
                          </Link>
                        </td>
                        <td className="capitalize text-muted">{formatSlugLabel(o.bookingType)}</td>
                        <td className="max-w-[10rem] truncate text-muted" title={o.branchName}>
                          {o.branchName ?? '—'}
                        </td>
                        <td className="capitalize text-sm text-slate-800">
                          {o.dispatchStatus ? formatSlugLabel(o.dispatchStatus) : formatSlugLabel(o.status)}
                        </td>
                        <td>
                          {o.operationsConflict ? (
                            <span className="badge-danger">Conflict</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className={slaBadgeClass(o.sla.status)}>{o.sla.label}</span>
                        </td>
                        <td className="text-right text-sm font-medium tabular-nums">{formatPeso(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
