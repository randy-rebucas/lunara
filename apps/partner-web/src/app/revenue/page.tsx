'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import type { PartnerRevenueData } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { formatChartDate, formatChartDay, formatPeso } from '../../lib/format-peso';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

export default function RevenuePage() {
  const { ready } = useRequirePartner();

  const load = useCallback(async () => {
    return partnerFetch<PartnerRevenueData>('/partner/revenue');
  }, []);

  const { data, loading, error, reload } = usePartnerQuery(load, []);

  const chart = useMemo(() => {
    if (!data?.daily.length) return { maxRevenue: 1, totalWeek: 0, bestDay: null as string | null };
    const maxRevenue = Math.max(...data.daily.map((d) => d.revenue), 1);
    const totalWeek = data.daily.reduce((s, d) => s + d.revenue, 0);
    const best = [...data.daily].sort((a, b) => b.revenue - a.revenue)[0];
    return { maxRevenue, totalWeek, bestDay: best?.date ?? null };
  }, [data]);

  if (!ready) return <AuthLoading message="Loading revenue…" />;

  return (
    <div>
      <PageHeader
        title="Revenue"
        description="Completed order totals for your shop. Amounts reflect orders marked delivered or completed."
        actions={
          <>
            <button type="button" className="btn-outline btn-sm" onClick={() => reload()}>
              Refresh
            </button>
            <Link href="/reports" className="btn-outline btn-sm">
              Full reports →
            </Link>
          </>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading revenue…" />
      </div>

      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-card !border-accent/30 !bg-accent/5">
              <p className="text-xs text-muted">Today</p>
              <p className="text-2xl font-semibold text-accent">{formatPeso(data.today)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.todayOrders} order{data.todayOrders === 1 ? '' : 's'}
                {data.todayOrders > 0 ? ` · avg ${formatPeso(data.avgOrderToday, true)}` : ''}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">Last 7 days</p>
              <p className="text-2xl font-semibold text-slate-900">{formatPeso(data.week)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.weekOrders} completed order{data.weekOrders === 1 ? '' : 's'}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">Month to date</p>
              <p className="text-2xl font-semibold text-slate-900">{formatPeso(data.month)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.monthOrders} order{data.monthOrders === 1 ? '' : 's'}
                {data.monthOrders > 0 ? ` · avg ${formatPeso(data.avgOrderMonth, true)}` : ''}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">All time</p>
              <p className="text-2xl font-semibold text-slate-900">{formatPeso(data.allTimeRevenue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.allTimeCompletedOrders} completed order
                {data.allTimeCompletedOrders === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <Card className="mt-8">
            <CardBody>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Daily breakdown</h3>
                  <p className="mt-1 text-sm text-muted">
                    Last 7 calendar days · {formatPeso(chart.totalWeek)} total
                  </p>
                </div>
                {chart.bestDay && (
                  <p className="text-xs text-muted-foreground">
                    Best day: {formatChartDate(chart.bestDay)}
                  </p>
                )}
              </div>

              <div className="mt-8 flex items-end gap-2 sm:gap-3" style={{ minHeight: 180 }}>
                {data.daily.map((d) => {
                  const height = Math.max(6, (d.revenue / chart.maxRevenue) * 140);
                  const hasOrders = d.orders > 0;
                  return (
                    <div
                      key={d.date}
                      className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                      title={`${formatChartDate(d.date)}: ${formatPeso(d.revenue)} · ${d.orders} orders`}
                    >
                      <span className="text-[10px] font-medium text-slate-700 sm:text-xs">
                        {d.revenue > 0 ? formatPeso(d.revenue, true) : '—'}
                      </span>
                      <div
                        className={`w-full rounded-t transition-all ${
                          hasOrders ? 'bg-primary/85' : 'bg-slate-200'
                        }`}
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-[10px] font-medium text-slate-600">{formatChartDay(d.date)}</span>
                      <span className="text-[10px] text-muted-foreground">{d.orders} ord.</span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <div className="section-panel mt-8 overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Orders</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[...data.daily].reverse().map((d) => (
                  <tr key={d.date}>
                    <td className="text-slate-900">{formatChartDate(d.date)}</td>
                    <td className="text-muted">{d.orders}</td>
                    <td className="text-right font-medium text-slate-900">{formatPeso(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/60 bg-slate-50/80 font-medium">
                  <td className="text-slate-900">7-day total</td>
                  <td className="text-muted">{data.weekOrders}</td>
                  <td className="text-right text-accent">{formatPeso(data.week)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
