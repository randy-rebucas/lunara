'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { CompareLineChart, DonutChart } from './dash-charts';
import type { DonutSegment } from './dash-charts';
import { adminFetch } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';
import { formatChartDay, formatPeso, formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface RevenueData {
  today: number;
  month: number;
  todayOrders: number;
  monthOrders: number;
  allTimeCompleted: number;
  daily: DailyPoint[];
  byService: { service: string; revenue: number; count: number }[];
  week: {
    revenue: number;
    orders: number;
    subtotal: number;
    deliveryFees: number;
    discounts: number;
    revenueDelta: number | null;
    ordersDelta: number | null;
    avgOrderValue: number;
    avgPerDay: number;
  };
  prevWeek: { revenue: number; orders: number };
  prevDaily: DailyPoint[];
  byBranch: { name: string; revenue: number; orders: number; avgOrderValue: number }[];
  byPayment: { method: string; amount: number; count: number }[];
  topDays: DailyPoint[];
  summary: {
    thisMonth: { revenue: number; orders: number };
    lastMonth: { revenue: number; orders: number };
    ytd: { revenue: number; orders: number };
  };
}

type RevenueState = 'nominal' | 'attention';

const revenueCopy: Record<
  RevenueState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Revenue on track',
    detail: 'Completed order revenue is flowing for the current period.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Revenue attention',
    detail: 'No week-to-date revenue yet, or today is below recent daily pace.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
};

const PAYMENT_COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  '#f59e0b',
  '#8b5cf6',
  '#64748b',
  '#ef4444',
];

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
  delta,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  tone: keyof typeof TILE_TONES;
}) {
  const trendClass =
    delta == null || delta === 0
      ? 'dc-metric-trend-flat'
      : delta > 0
        ? 'dc-metric-trend-up'
        : 'dc-metric-trend-down';
  return (
    <div className={`rounded-xl p-4 ring-1 ${TILE_TONES[tone]}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {delta != null ? (
          <span className={`dc-metric-trend ${trendClass}`}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)}%
          </span>
        ) : null}
        {sub ? <span className="dc-sublabel">{sub}</span> : null}
      </div>
    </div>
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

function ShareBar({ value, max, color = 'bg-primary/80' }: { value: number; max: number; color?: string }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

function deriveRevenueState(data: RevenueData): RevenueState {
  if (data.week.revenue === 0) return 'attention';
  const avgDaily = data.daily.reduce((sum, d) => sum + d.revenue, 0) / Math.max(data.daily.length, 1);
  const todayRevenue = data.daily[data.daily.length - 1]?.revenue ?? 0;
  if (avgDaily > 0 && todayRevenue === 0) return 'attention';
  return 'nominal';
}

// ── Board ──────────────────────────────────────────────────────────────────
export function RevenueBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const data = await adminFetch<RevenueData>('/admin/revenue');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  const revenueState = data ? deriveRevenueState(data) : 'nominal';
  const copy = revenueCopy[revenueState];

  const dayLabels = useMemo(
    () => (data ? data.daily.map((d) => formatChartDay(d.date)) : []),
    [data],
  );

  const laundryNet = data ? Math.max(0, data.week.subtotal - data.week.discounts) : 0;
  const breakdownSegments: DonutSegment[] = data
    ? [
        { key: 'laundry', label: 'Laundry services', count: laundryNet, color: 'var(--color-primary)' },
        { key: 'delivery', label: 'Delivery fees', count: data.week.deliveryFees, color: 'var(--color-accent)' },
      ]
    : [];

  const paymentSegments: DonutSegment[] = (data?.byPayment ?? []).map((p, i) => ({
    key: p.method,
    label: formatSlugLabel(p.method),
    count: p.amount,
    color: PAYMENT_COLORS[i % PAYMENT_COLORS.length],
  }));
  const paymentTotal = paymentSegments.reduce((s, p) => s + p.count, 0);

  const maxBranchRevenue = Math.max(1, ...(data?.byBranch ?? []).map((b) => b.revenue));
  const maxServiceRevenue = Math.max(1, ...(data?.byService ?? []).map((s) => s.revenue));

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Revenue
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Completed order revenue — weekly trend, composition, and where it comes from.
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
            <Link href="/reconciliation" className="btn-outline btn-sm">
              Reconciliation
            </Link>
            <Link href="/reports" className="btn-primary btn-sm">
              Full reports
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
          Loading revenue…
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
            {data.week.orders > 0 ? (
              <span className="badge-accent px-3 py-1 text-xs font-semibold">
                {data.week.orders} orders this week
              </span>
            ) : (
              <span className="badge-warning px-3 py-1 text-xs font-semibold">No orders this week</span>
            )}
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Revenue (7d)"
              value={formatPeso(data.week.revenue, true)}
              delta={data.week.revenueDelta}
              sub="vs prior week"
              tone="primary"
            />
            <StatTile
              label="Laundry services (7d)"
              value={formatPeso(laundryNet, true)}
              sub="subtotal less discounts"
              tone="accent"
            />
            <StatTile
              label="Delivery fees (7d)"
              value={formatPeso(data.week.deliveryFees, true)}
              sub="customer delivery charges"
              tone="secondary"
            />
            <StatTile
              label="Discounts given (7d)"
              value={`−${formatPeso(data.week.discounts, true)}`}
              sub="promos & coupons"
              tone="amber"
            />
            <StatTile
              label="Orders (7d)"
              value={data.week.orders.toLocaleString()}
              delta={data.week.ordersDelta}
              sub="vs prior week"
              tone="violet"
            />
            <StatTile
              label="Avg revenue / day"
              value={formatPeso(data.week.avgPerDay, true)}
              sub={`AOV ${formatPeso(data.week.avgOrderValue, true)}`}
              tone="rose"
            />
          </div>

          {/* Trend / breakdown / top days */}
          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <section className="dc-panel min-w-0 xl:col-span-6">
              <PanelHeader title="Revenue overview" sub="Completed revenue per day — this week vs prior week" />
              <div className="dc-panel-body">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <span className="inline-block h-0.5 w-4 rounded-full bg-primary" aria-hidden /> This week
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <span
                      className="inline-block h-0.5 w-4 rounded-full"
                      style={{ backgroundColor: '#94a3b8' }}
                      aria-hidden
                    />{' '}
                    Prior week
                  </span>
                </div>
                <div className="mt-2">
                  <CompareLineChart
                    labels={dayLabels}
                    labelEvery={1}
                    series={[
                      {
                        label: 'This week',
                        color: 'var(--color-primary)',
                        values: data.daily.map((d) => d.revenue),
                      },
                      {
                        label: 'Prior week',
                        color: '#94a3b8',
                        dashed: true,
                        values: data.prevDaily.map((d) => d.revenue),
                      },
                    ]}
                    formatValue={(v) => formatPeso(v, true)}
                    ariaLabel="Completed revenue per day, this week versus prior week"
                  />
                </div>
              </div>
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="Revenue breakdown" sub="This week's composition" />
              <div className="dc-panel-body">
                <DonutChart
                  segments={breakdownSegments}
                  centerValue={formatPeso(data.week.revenue, true)}
                  centerLabel="This week"
                />
                <ul className="mt-3 space-y-2.5">
                  {breakdownSegments.map((s) => (
                    <li key={s.key}>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: s.color }}
                          aria-hidden
                        />
                        <span className="flex-1 text-muted">{s.label}</span>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {formatPesoWhole(s.count)}
                        </span>
                        <span className="w-11 text-right tabular-nums text-muted">
                          {data.week.revenue > 0
                            ? `${((s.count / data.week.revenue) * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                    </li>
                  ))}
                  <li className="flex items-center gap-2 border-t border-border/60 pt-2 text-xs">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-400" aria-hidden />
                    <span className="flex-1 text-muted">Discounts given</span>
                    <span className="font-semibold tabular-nums text-red-600">
                      −{formatPesoWhole(data.week.discounts)}
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="Top revenue days" sub="This week" />
              {data.topDays.length === 0 ? (
                <p className="dc-panel-empty text-sm text-muted">No completed revenue this week.</p>
              ) : (
                <ol className="divide-y divide-border/40">
                  {data.topDays.map((d, i) => (
                    <li key={d.date} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-muted">
                          {d.orders} order{d.orders === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">
                        {formatPesoWhole(d.revenue)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          {/* Branch / payment / service mix */}
          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <section className="dc-panel min-w-0 xl:col-span-6">
              <PanelHeader
                title="Revenue by shop"
                sub="Completed orders this week"
                action={{ href: '/shops', label: 'View all' }}
              />
              {data.byBranch.length === 0 ? (
                <p className="dc-panel-empty text-sm text-muted">No completed orders this week.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[480px]">
                    <caption className="sr-only">Revenue by laundry shop this week</caption>
                    <thead>
                      <tr>
                        <th scope="col">Shop</th>
                        <th scope="col" className="text-right">Orders</th>
                        <th scope="col" className="text-right">Avg order</th>
                        <th scope="col" className="text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byBranch.map((b) => (
                        <tr key={b.name}>
                          <td>
                            <p className="max-w-[14rem] truncate text-sm font-medium text-slate-900" title={b.name}>
                              {b.name}
                            </p>
                            <ShareBar value={b.revenue} max={maxBranchRevenue} />
                          </td>
                          <td className="text-right tabular-nums">{b.orders}</td>
                          <td className="text-right tabular-nums text-muted">
                            {formatPesoWhole(b.avgOrderValue)}
                          </td>
                          <td className="text-right text-sm font-semibold tabular-nums">
                            {formatPesoWhole(b.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="Payment methods" sub="Order payments captured this week" />
              <div className="dc-panel-body">
                {paymentSegments.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">No payments captured this week.</p>
                ) : (
                  <>
                    <DonutChart
                      segments={paymentSegments}
                      centerValue={formatPeso(paymentTotal, true)}
                      centerLabel="Captured"
                    />
                    <ul className="mt-3 space-y-1.5">
                      {paymentSegments.map((p) => (
                        <li key={p.key} className="flex items-center gap-2 text-xs">
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: p.color }}
                            aria-hidden
                          />
                          <span className="flex-1 capitalize text-muted">{p.label}</span>
                          <span className="font-semibold tabular-nums text-slate-900">
                            {formatPesoWhole(p.count)}
                          </span>
                          <span className="w-11 text-right tabular-nums text-muted">
                            {paymentTotal > 0 ? `${((p.count / paymentTotal) * 100).toFixed(1)}%` : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>

            <section className="dc-panel xl:col-span-3">
              <PanelHeader title="Revenue by service" sub="This week" />
              {data.byService.length === 0 ? (
                <p className="dc-panel-empty text-sm text-muted">No completed orders this week.</p>
              ) : (
                <ul className="space-y-3 px-4 py-4">
                  {data.byService.slice(0, 6).map((s) => (
                    <li key={s.service}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate capitalize text-slate-900">
                          {formatSlugLabel(s.service)}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                          {formatPesoWhole(s.revenue)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShareBar value={s.revenue} max={maxServiceRevenue} color="bg-accent/70" />
                        <span className="shrink-0 text-xs tabular-nums text-muted">{s.count} ord</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Period summary */}
          <section className="dc-panel">
            <PanelHeader title="Revenue summary" sub="Longer periods at a glance" action={{ href: '/reports', label: 'Reports' }} />
            <div className="grid grid-cols-2 gap-px bg-border/60 lg:grid-cols-4">
              {[
                { label: 'This week', ...{ revenue: data.week.revenue, orders: data.week.orders } },
                { label: 'This month', ...data.summary.thisMonth },
                { label: 'Last month', ...data.summary.lastMonth },
                { label: `YTD ${new Date().getFullYear()}`, ...data.summary.ytd },
              ].map((p) => (
                <div key={p.label} className="bg-surface px-5 py-4">
                  <p className="dc-label">{p.label}</p>
                  <p className="dc-value mt-1">{formatPeso(p.revenue, true)}</p>
                  <p className="dc-sublabel mt-0.5">
                    {p.orders.toLocaleString()} order{p.orders === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
