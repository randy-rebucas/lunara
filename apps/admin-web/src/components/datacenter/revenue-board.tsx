'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';
import { formatChartDay, formatPeso, formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface RevenueData {
  today: number;
  month: number;
  todayOrders: number;
  monthOrders: number;
  allTimeCompleted: number;
  daily: { date: string; revenue: number; orders: number }[];
  byService: { service: string; revenue: number; count: number }[];
}

type RevenueState = 'nominal' | 'attention';

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/orders', label: 'Orders' },
  { href: '/shops', label: 'Shops' },
  { href: '/reports', label: 'Reports' },
  { href: '/refunds', label: 'Refunds' },
] as const;

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
    detail: 'No month-to-date revenue yet, or today is below recent daily pace.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
};

function deriveRevenueState(data: RevenueData): RevenueState {
  if (data.month === 0) return 'attention';
  const avgDaily = data.daily.reduce((sum, d) => sum + d.revenue, 0) / Math.max(data.daily.length, 1);
  const todayRevenue = data.daily[data.daily.length - 1]?.revenue ?? 0;
  if (avgDaily > 0 && todayRevenue === 0) return 'attention';
  return 'nominal';
}

export function RevenueBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const data = await adminFetch<RevenueData>('/admin/revenue');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  const maxDaily = useMemo(
    () => (data ? Math.max(...data.daily.map((d) => d.revenue), 1) : 1),
    [data],
  );

  const revenueState = data ? deriveRevenueState(data) : 'nominal';
  const copy = revenueCopy[revenueState];

  const avgOrderToday = data && data.todayOrders > 0 ? Math.round(data.today / data.todayOrders) : null;
  const avgOrderMonth =
    data && data.monthOrders > 0 ? Math.round(data.month / data.monthOrders) : null;

  const serviceRows = useMemo(() => {
    if (!data?.byService.length) return [];
    const monthTotal = data.byService.reduce((sum, s) => sum + s.revenue, 0) || 1;
    return [...data.byService]
      .sort((a, b) => b.revenue - a.revenue)
      .map((s) => ({
        ...s,
        share: Math.round((s.revenue / monthTotal) * 100),
      }));
  }, [data]);

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  return (
    <div>
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Revenue
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Platform-wide completed order revenue — today, month-to-date, and 7-day trend. For
              period analytics see{' '}
              <Link href="/reports" className="link-primary">
                Reports
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-neutral">Polling</span>
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
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {data.monthOrders > 0 ? (
              <span className="badge-accent px-3 py-1 text-xs font-semibold">
                {data.monthOrders} orders MTD
              </span>
            ) : (
              <span className="badge-warning px-3 py-1 text-xs font-semibold">No MTD orders</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCell
              label="Today"
              value={formatPeso(data.today)}
              sub={`${data.todayOrders} orders`}
              highlight={data.today > 0 ? 'accent' : data.month > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="This month"
              value={formatPeso(data.month)}
              sub={`${data.monthOrders} orders`}
              highlight={data.month > 0 ? 'primary' : undefined}
            />
            <MetricCell
              label="Avg order · today"
              value={avgOrderToday != null ? formatPeso(avgOrderToday) : '—'}
            />
            <MetricCell
              label="Avg order · MTD"
              value={avgOrderMonth != null ? formatPeso(avgOrderMonth) : '—'}
            />
            <MetricCell
              label="All-time completed"
              value={data.allTimeCompleted.toLocaleString()}
              href="/orders"
            />
            <MetricCell
              label="Service lines"
              value={data.byService.length}
              sub="MTD breakdown"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-md border border-border/80 bg-surface px-3 py-1.5 dc-chip transition-colors hover:border-primary/40 hover:text-primary"
              >
                {a.label}
              </Link>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <section className="dc-panel xl:col-span-3" id="revenue-trend">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">7-day revenue trend</h2>
                  <p className="text-xs text-muted">Completed orders by completion date</p>
                </div>
                <span className="text-xs text-muted tabular-nums">
                  Peak {formatPesoWhole(maxDaily === 1 && data.daily.every((d) => d.revenue === 0) ? 0 : maxDaily)}
                </span>
              </div>
              <div className="dc-panel-body">
                {data.daily.every((d) => d.revenue === 0) ? (
                  <div className="dc-panel-empty py-8">
                    <p className="font-medium text-slate-900">No completed revenue in the last 7 days</p>
                    <p className="mt-1 text-sm text-muted">
                      Revenue appears when orders reach a completed status.
                    </p>
                  </div>
                ) : (
                  <div
                    className="flex items-end gap-2"
                    style={{ minHeight: 160 }}
                    role="img"
                    aria-label="Seven day revenue bar chart"
                  >
                    {data.daily.map((d) => (
                      <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <span className="text-xs font-medium text-slate-700 tabular-nums">
                          {formatPesoWhole(d.revenue)}
                        </span>
                        <div
                          className="w-full rounded-t bg-primary transition-[height]"
                          style={{ height: `${Math.max(8, (d.revenue / maxDaily) * 120)}px` }}
                          title={`${d.orders} order${d.orders === 1 ? '' : 's'}`}
                        />
                        <span className="text-[10px] text-muted">{formatChartDay(d.date)}</span>
                        <span className="text-[10px] text-muted tabular-nums">{d.orders} ord</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="dc-panel xl:col-span-2" id="revenue-services">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Revenue by service</h2>
                <p className="text-xs text-muted">Month-to-date completed orders</p>
              </div>

              {serviceRows.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">No completed orders this month</p>
                  <p className="mt-1 text-sm text-muted">
                    Service mix will appear once orders complete.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[320px]">
                    <caption className="sr-only">Revenue by service month to date</caption>
                    <thead>
                      <tr>
                        <th scope="col">Service</th>
                        <th scope="col" className="text-right">
                          Orders
                        </th>
                        <th scope="col" className="text-right">
                          Revenue
                        </th>
                        <th scope="col" className="text-right">
                          Share
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceRows.map((s) => (
                        <tr key={s.service}>
                          <td className="font-medium capitalize">{formatSlugLabel(s.service)}</td>
                          <td className="text-right tabular-nums">{s.count}</td>
                          <td className="text-right tabular-nums">{formatPesoWhole(s.revenue)}</td>
                          <td className="text-right tabular-nums text-muted">{s.share}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Daily ledger</h2>
                <p className="text-xs text-muted">Last 7 days · revenue and order count</p>
              </div>
              <Link href="/orders" className="link-primary text-xs font-medium">
                Order ledger →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[480px]">
                <caption className="sr-only">Daily revenue ledger</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col" className="text-right">
                      Orders
                    </th>
                    <th scope="col" className="text-right">
                      Revenue
                    </th>
                    <th scope="col" className="text-right">
                      Avg order
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.daily].reverse().map((d) => (
                    <tr key={d.date}>
                      <td className="font-medium">{formatChartDay(d.date)}</td>
                      <td className="text-right tabular-nums">{d.orders}</td>
                      <td className="text-right tabular-nums">{formatPesoWhole(d.revenue)}</td>
                      <td className="text-right tabular-nums text-muted">
                        {d.orders > 0 ? formatPesoWhole(Math.round(d.revenue / d.orders)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
