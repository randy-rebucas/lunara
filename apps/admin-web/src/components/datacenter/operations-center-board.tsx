'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DonutChart, RevenueBarChart, TrendLegend, TrendLineChart } from './dash-charts';
import type { DonutSegment, TrendPoint } from './dash-charts';
import { adminFetch, getAdminUser } from '../../lib/admin-api';
import { formatOrderId, formatSlugLabel } from '../../lib/format-label';
import { formatPeso } from '../../lib/format-peso';
import { isAdminRealtimeConnected } from '../../lib/admin-realtime';
import { useAdminQuery } from '../../lib/use-admin-query';
import { useAdminOperationsSocket } from '../../lib/use-admin-operations-socket';

interface DashboardData {
  counts: {
    activeOrders: number;
    ordersToday: number;
    ridersOnline: number;
    totalRiders: number;
    partners: number;
    staff: number;
    customers: number;
    openTickets: number;
    activePromos: number;
    pendingDispatch: number;
  };
  revenue: { month: number; monthOrders: number; week: number };
  deltas: { orders: number | null; completed: number | null; revenue: number | null };
  week: { orders: number; completed: number };
  trend: TrendPoint[];
  revenueDaily: { date: string; revenue: number; orders: number }[];
  statusBreakdown: { key: string; label: string; count: number }[];
  topBranches: { id: string; name: string; orders: number; revenue: number }[];
  topRiders: { id: string; name: string; deliveries: number }[];
  totals: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    cancellationRate: number;
  };
  activity: { orderId: string; status: string; branchName: string | null; at: string }[];
  recentOrders: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
    customer: string | null;
    branchName: string | null;
    riderName: string | null;
    createdAt: string;
  }[];
}

type SystemState = 'nominal' | 'attention' | 'critical';

function deriveSystemState(counts: DashboardData['counts']): SystemState {
  if (counts.pendingDispatch >= 10 || counts.openTickets >= 15) return 'critical';
  if (counts.pendingDispatch > 0 || counts.openTickets > 0 || counts.activeOrders >= 50) return 'attention';
  return 'nominal';
}

const systemCopy: Record<SystemState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal: {
    label: 'All systems nominal',
    detail: 'No critical queue backlogs detected.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Elevated load',
    detail: 'Review dispatch queue and open support tickets.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'High priority',
    detail: 'Immediate ops review recommended.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

function statusTone(status: string): string {
  if (status === 'pending' || status === 'pending_dispatch') return 'badge-warning';
  if (status.includes('cancel') || status === 'refunded') return 'badge-danger';
  if (status === 'completed' || status === 'delivered') return 'badge-accent';
  if (status.includes('rider') || status.includes('pickup') || status.includes('delivery')) {
    return 'badge-primary';
  }
  return 'badge-secondary';
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: 'var(--color-primary)',
  in_progress: '#8b5cf6',
  out_for_delivery: '#f97316',
  completed: 'var(--color-accent)',
  cancelled: '#ef4444',
};

// ── Icons ──────────────────────────────────────────────────────────────────
function Icon({ d, d2, className = 'h-5 w-5' }: { d: string; d2?: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
    </svg>
  );
}

const icons = {
  orders: <Icon d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />,
  active: <Icon d="M13 10V3L4 14h7v7l9-11h-7z" />,
  completed: <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  revenue: <Icon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  shops: <Icon d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  riders: <Icon d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
  dispatch: <Icon d="M13 10V3L4 14h7v7l9-11h-7z" />,
  partner: <Icon d="M12 6v6m0 0v6m0-6h6m-6 0H6" />,
  announce: <Icon d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />,
  promo: <Icon d="M9 4H6a2 2 0 00-2 2v3l7.586 7.586a2 2 0 002.828 0l4.586-4.586a2 2 0 000-2.828L11.414 4H9z" d2="M7 8h.01" />,
  report: <Icon d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  tracking: <Icon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" d2="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />,
};

// ── Small building blocks ──────────────────────────────────────────────────
const STAT_TONES = {
  primary: { card: 'bg-primary/[0.04] ring-primary/15', chip: 'bg-primary/10 text-primary' },
  secondary: { card: 'bg-secondary/[0.04] ring-secondary/15', chip: 'bg-secondary/10 text-secondary' },
  amber: { card: 'bg-amber-500/[0.04] ring-amber-500/20', chip: 'bg-amber-500/10 text-amber-600' },
  violet: { card: 'bg-violet-500/[0.04] ring-violet-500/20', chip: 'bg-violet-500/10 text-violet-600' },
  accent: { card: 'bg-accent/[0.04] ring-accent/20', chip: 'bg-accent/10 text-accent' },
  rose: { card: 'bg-rose-500/[0.04] ring-rose-500/20', chip: 'bg-rose-500/10 text-rose-600' },
} as const;

function DashStatCard({
  label,
  value,
  icon,
  tone,
  href,
  delta,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: keyof typeof STAT_TONES;
  href: string;
  delta?: number | null;
  sub?: string;
}) {
  const t = STAT_TONES[tone];
  const trendClass =
    delta == null || delta === 0
      ? 'dc-metric-trend-flat'
      : delta > 0
        ? 'dc-metric-trend-up'
        : 'dc-metric-trend-down';

  return (
    <Link
      href={href}
      className={`block rounded-lg p-4 ring-1 transition-all hover:shadow-[var(--shadow-elevated)] ${t.card}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>
          {icon}
        </span>
      </div>
      <p className="dc-value -mt-2">{value}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {delta != null ? (
          <span className={`dc-metric-trend ${trendClass}`}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)}%
          </span>
        ) : null}
        {sub ? <span className="dc-sublabel">{sub}</span> : null}
      </div>
    </Link>
  );
}

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

function LeaderboardRow({
  rank,
  name,
  detail,
  value,
}: {
  rank: number;
  name: string;
  detail: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <span className="text-sm font-semibold tabular-nums text-slate-900">{value}</span>
    </li>
  );
}

const QUICK_ACTIONS = [
  { href: '/dispatch', label: 'Dispatch queue', icon: icons.dispatch },
  { href: '/control-tower', label: 'Live tracking', icon: icons.tracking },
  { href: '/partners/new', label: 'Add partner', icon: icons.partner },
  { href: '/notifications', label: 'Announcement', icon: icons.announce },
  { href: '/promotions', label: 'Promotion', icon: icons.promo },
  { href: '/reports', label: 'Reports', icon: icons.report },
] as const;

function timeAgo(value: string | Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Board ──────────────────────────────────────────────────────────────────
export function OperationsCenterBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);

  const load = useCallback(async () => {
    const data = await adminFetch<DashboardData>('/admin/dashboard');
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
    setSocketLive(isAdminRealtimeConnected());
    const id = setInterval(() => setSocketLive(isAdminRealtimeConnected()), 2000);
    return () => clearInterval(id);
  }, [data]);

  const user = getAdminUser();
  const firstName = user?.email ? user.email.split('@')[0].split(/[._-]/)[0] : null;
  const displayName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
    : 'Admin';

  const system = data ? deriveSystemState(data.counts) : 'nominal';
  const sys = systemCopy[system];

  const riderPct = data && data.counts.totalRiders > 0
    ? Math.round((data.counts.ridersOnline / data.counts.totalRiders) * 100)
    : 0;

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const donutSegments: DonutSegment[] = (data?.statusBreakdown ?? []).map((s) => ({
    key: s.key,
    label: s.label,
    count: s.count,
    color: STATUS_COLORS[s.key] ?? '#94a3b8',
  }));
  const donutTotal = donutSegments.reduce((s, seg) => s + seg.count, 0);

  return (
    <div>
      <header className="mb-5">
        {/* Instrument strip — mirrors the console shell: status readouts before headline */}
        <div className="console mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border console-line px-4 py-2.5">
          <span className="console-eyebrow flex items-center gap-1.5">
            <span className="console-signal-dot" aria-hidden />
            {socketLive ? 'Realtime link' : 'Polling'}
          </span>
          <span className="console-readout">Refreshed {updatedLabel}</span>
          <span className={`console-readout ${system === 'nominal' ? 'text-[color:var(--color-signal)]' : system === 'attention' ? 'text-amber-400' : 'text-red-400'}`}>
            {sys.label.toUpperCase()}
          </span>
          <button
            type="button"
            className="ml-auto font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-[color:var(--color-console-muted)] transition-colors hover:text-[color:var(--color-console-fg)] disabled:opacity-50"
            onClick={() => void reload()}
            disabled={loading}
          >
            {loading ? 'Syncing…' : '↻ Sync'}
          </button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Lunara platform</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome back, {displayName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Here&apos;s what&apos;s happening with your laundry business today.
            </p>
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
          Loading telemetry…
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {/* System state banner */}
          <div className={`flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 ${sys.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${sys.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{sys.label}</p>
              <p className="text-xs text-muted">{sys.detail}</p>
            </div>
            {data.counts.pendingDispatch > 0 ? (
              <Link href="/dispatch" className="badge-warning px-3 py-1 text-xs font-semibold">
                {data.counts.pendingDispatch} dispatch
              </Link>
            ) : null}
            {data.counts.openTickets > 0 ? (
              <Link href="/support" className="badge-primary px-3 py-1 text-xs font-semibold">
                {data.counts.openTickets} tickets
              </Link>
            ) : null}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            <DashStatCard
              label="Orders (7d)"
              value={data.week.orders.toLocaleString()}
              icon={icons.orders}
              tone="primary"
              href="/orders"
              delta={data.deltas.orders}
              sub="vs last week"
            />
            <DashStatCard
              label="Active orders"
              value={data.counts.activeOrders.toLocaleString()}
              icon={icons.active}
              tone="secondary"
              href="/orders"
              sub={`${data.counts.ordersToday} created today`}
            />
            <DashStatCard
              label="Completed (7d)"
              value={data.week.completed.toLocaleString()}
              icon={icons.completed}
              tone="accent"
              href="/orders?status=completed"
              delta={data.deltas.completed}
              sub="vs last week"
            />
            <DashStatCard
              label="Revenue (7d)"
              value={formatPeso(data.revenue.week, true)}
              icon={icons.revenue}
              tone="violet"
              href="/revenue"
              delta={data.deltas.revenue}
              sub="vs last week"
            />
            <DashStatCard
              label="Laundry partners"
              value={data.counts.partners.toLocaleString()}
              icon={icons.shops}
              tone="amber"
              href="/partners"
              sub={`${data.counts.activePromos} active promos`}
            />
            <DashStatCard
              label="Riders"
              value={data.counts.totalRiders.toLocaleString()}
              icon={icons.riders}
              tone="rose"
              href="/riders"
              sub={`Online: ${data.counts.ridersOnline} (${riderPct}%)`}
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-4 xl:grid-cols-12">
            <section className="dc-panel xl:col-span-5">
              <PanelHeader title="Orders overview" sub="Last 7 days" />
              <div className="dc-panel-body">
                <TrendLegend />
                <div className="mt-2">
                  <TrendLineChart data={data.trend} />
                </div>
              </div>
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="Orders by status" sub="All time" />
              <div className="dc-panel-body">
                <DonutChart
                  segments={donutSegments}
                  centerValue={data.totals.totalOrders.toLocaleString()}
                  centerLabel="Total"
                />
                <ul className="mt-3 space-y-1.5">
                  {donutSegments.map((s) => (
                    <li key={s.key} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <span className="flex-1 text-muted">{s.label}</span>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {s.count.toLocaleString()}
                      </span>
                      <span className="w-11 text-right tabular-nums text-muted">
                        {donutTotal > 0 ? `${((s.count / donutTotal) * 100).toFixed(1)}%` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <div className="space-y-4 xl:col-span-4">
              <section className="dc-panel">
                <PanelHeader title="Quick actions" />
                <div className="grid grid-cols-3 gap-2 p-3">
                  {QUICK_ACTIONS.map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-center ring-1 ring-border/60 transition-colors hover:bg-primary/5 hover:ring-primary/30"
                    >
                      <span className="text-primary">{a.icon}</span>
                      <span className="text-xs font-medium text-slate-700">{a.label}</span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="dc-panel">
                <PanelHeader title="Live activity" action={{ href: '/orders', label: 'View all' }} />
                {data.activity.length === 0 ? (
                  <p className="dc-panel-empty text-sm text-muted">No recent activity.</p>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {data.activity.slice(0, 5).map((a) => (
                      <li key={`${a.orderId}-${a.at}`} className="flex items-center gap-3 px-3.5 py-2.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            statusTone(a.status) === 'badge-warning'
                              ? 'bg-amber-500'
                              : statusTone(a.status) === 'badge-danger'
                                ? 'bg-red-500'
                                : statusTone(a.status) === 'badge-accent'
                                  ? 'bg-accent'
                                  : 'bg-primary'
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-900">
                            <Link href={`/orders/${a.orderId}`} className="link-primary text-code">
                              {formatOrderId(a.orderId)}
                            </Link>{' '}
                            <span className="capitalize">{formatSlugLabel(a.status)}</span>
                          </p>
                          {a.branchName ? (
                            <p className="truncate text-xs text-muted">{a.branchName}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{timeAgo(a.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          {/* Leaderboards + revenue */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="dc-panel">
              <PanelHeader title="Top laundry shops" sub="This week" action={{ href: '/partners', label: 'View all' }} />
              {data.topBranches.length === 0 ? (
                <p className="dc-panel-empty text-sm text-muted">No completed orders this week.</p>
              ) : (
                <ol className="divide-y divide-border/40">
                  {data.topBranches.map((b, i) => (
                    <LeaderboardRow
                      key={b.id}
                      rank={i + 1}
                      name={b.name}
                      detail={`${b.orders} order${b.orders === 1 ? '' : 's'}`}
                      value={formatPeso(b.revenue, true)}
                    />
                  ))}
                </ol>
              )}
            </section>

            <section className="dc-panel">
              <PanelHeader title="Top riders" sub="This week" action={{ href: '/riders', label: 'View all' }} />
              {data.topRiders.length === 0 ? (
                <p className="dc-panel-empty text-sm text-muted">No deliveries this week.</p>
              ) : (
                <ol className="divide-y divide-border/40">
                  {data.topRiders.map((r, i) => (
                    <LeaderboardRow
                      key={r.id}
                      rank={i + 1}
                      name={r.name}
                      detail="completed deliveries"
                      value={String(r.deliveries)}
                    />
                  ))}
                </ol>
              )}
            </section>

            <section className="dc-panel">
              <PanelHeader title="Revenue overview" sub="Last 7 days" action={{ href: '/revenue', label: 'Details' }} />
              <div className="dc-panel-body">
                <p className="dc-value">{formatPeso(data.revenue.week, true)}</p>
                <p className="dc-sublabel mb-2">completed order revenue this week</p>
                <p className="text-xs text-muted mb-2">
                  Month to date: <span className="font-semibold text-slate-900">{formatPeso(data.revenue.month, true)}</span>{' '}
                  across {data.revenue.monthOrders.toLocaleString()} order{data.revenue.monthOrders === 1 ? '' : 's'}
                </p>
                <RevenueBarChart data={data.revenueDaily} />
              </div>
            </section>
          </div>

          {/* Recent orders + system overview */}
          <div className="grid gap-4 xl:grid-cols-12">
            <section className="dc-panel xl:col-span-8">
              <PanelHeader title="Recent orders" sub="Most recently updated" action={{ href: '/orders', label: 'Full ledger' }} />
              {data.recentOrders.length === 0 ? (
                <p className="dc-panel-empty text-sm text-muted">No orders in feed.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <caption className="sr-only">Recent platform orders</caption>
                    <thead>
                      <tr>
                        <th scope="col">Order</th>
                        <th scope="col">Customer</th>
                        <th scope="col">Shop</th>
                        <th scope="col">Rider</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="text-right">Amount</th>
                        <th scope="col">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOrders.slice(0, 6).map((o) => (
                        <tr key={o._id}>
                          <td>
                            <Link href={`/orders/${o._id}`} className="link-primary text-code font-semibold">
                              {formatOrderId(o._id)}
                            </Link>
                            <p className="text-xs capitalize text-muted">{formatSlugLabel(o.bookingType)}</p>
                          </td>
                          <td className="max-w-[10rem] truncate text-muted" title={o.customer ?? undefined}>
                            {o.customer ?? '—'}
                          </td>
                          <td className="max-w-[9rem] truncate text-muted" title={o.branchName ?? undefined}>
                            {o.branchName ?? '—'}
                          </td>
                          <td className="max-w-[8rem] truncate text-muted">{o.riderName ?? '—'}</td>
                          <td>
                            <span className={`${statusTone(o.status)} capitalize`}>
                              {formatSlugLabel(o.status)}
                            </span>
                          </td>
                          <td className="text-right text-sm font-medium tabular-nums">
                            {formatPeso(o.total)}
                          </td>
                          <td className="whitespace-nowrap text-xs text-muted">{timeAgo(o.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="dc-panel xl:col-span-4">
              <PanelHeader title="System overview" sub="All-time platform totals" />
              <dl className="grid grid-cols-2 gap-px bg-border/60">
                {[
                  { label: 'Total customers', value: data.counts.customers.toLocaleString(), href: '/users' },
                  { label: 'Total orders', value: data.totals.totalOrders.toLocaleString(), href: '/orders' },
                  { label: 'Completed orders', value: data.totals.completedOrders.toLocaleString(), href: '/orders?status=completed' },
                  { label: 'Cancellation rate', value: `${data.totals.cancellationRate}%`, href: '/reports' },
                  { label: 'Staff accounts', value: data.counts.staff.toLocaleString(), href: '/users' },
                  { label: 'Open tickets', value: data.counts.openTickets.toLocaleString(), href: '/support' },
                ].map((row) => (
                  <div key={row.label} className="bg-surface px-4 py-3">
                    <dt className="dc-label">{row.label}</dt>
                    <dd className="mt-1">
                      <Link href={row.href} className="dc-value-sm link-primary hover:underline">
                        {row.value}
                      </Link>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
