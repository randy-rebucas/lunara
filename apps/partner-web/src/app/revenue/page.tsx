'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { PartnerOrderDetail, PartnerRevenueData } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { formatChartDate, formatChartDay, formatPeso } from '../../lib/format-peso';
import { exportCsv } from '../../lib/export-csv';
import { exportPdf } from '../../lib/export-pdf';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

type RevenueTab = 'overview' | 'branches' | 'orders';

function PaymentBadge({ method, cashCollected }: { method: string | null; cashCollected: boolean }) {
  if (!method) return <span className="text-muted">—</span>;
  if (method === 'CASH') {
    return cashCollected ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Cash collected
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Cash pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      {method === 'GCASH' ? 'GCash' : method === 'MAYA' ? 'Maya' : method === 'WALLET' ? 'Wallet' : method}
    </span>
  );
}

function StatCards({ data }: { data: PartnerRevenueData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="stat-card !border-accent/30 !bg-accent/5">
        <p className="text-xs text-muted">Today</p>
        <p className="text-2xl font-semibold text-accent">{formatPeso(data.todayPayout ?? data.today)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.todayOrders} order{data.todayOrders === 1 ? '' : 's'}
          {data.todayOrders > 0 ? ` · avg ${formatPeso(data.avgOrderToday, true)}` : ''}
        </p>
      </div>
      <div className="stat-card">
        <p className="text-xs text-muted">Last 7 days</p>
        <p className="text-2xl font-semibold text-slate-900">{formatPeso(data.weekPayout ?? data.week)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.weekOrders} completed order{data.weekOrders === 1 ? '' : 's'}
        </p>
      </div>
      <div className="stat-card">
        <p className="text-xs text-muted">Month to date</p>
        <p className="text-2xl font-semibold text-slate-900">{formatPeso(data.monthPayout ?? data.month)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.monthOrders} order{data.monthOrders === 1 ? '' : 's'}
          {data.monthOrders > 0 ? ` · avg ${formatPeso(data.avgOrderMonth, true)}` : ''}
        </p>
      </div>
      <div className="stat-card">
        <p className="text-xs text-muted">All time</p>
        <p className="text-2xl font-semibold text-slate-900">{formatPeso(data.allTimePayout ?? data.allTimeRevenue)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.allTimeCompletedOrders} completed order
          {data.allTimeCompletedOrders === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}

function DailyChart({
  daily,
  maxRevenue,
  totalWeek,
  bestDay,
}: {
  daily: PartnerRevenueData['daily'];
  maxRevenue: number;
  totalWeek: number;
  bestDay: string | null;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">Daily breakdown</h3>
            <p className="mt-1 text-sm text-muted">
              Last 7 calendar days · {formatPeso(totalWeek)} total
            </p>
          </div>
          {bestDay && (
            <p className="text-xs text-muted-foreground">Best day: {formatChartDate(bestDay)}</p>
          )}
        </div>

        <div className="mt-8 flex items-end gap-2 sm:gap-3" style={{ minHeight: 180 }}>
          {daily.map((d) => {
            const earnings = d.payout ?? d.revenue;
            const height = Math.max(6, (earnings / maxRevenue) * 140);
            const hasOrders = d.orders > 0;
            return (
              <div
                key={d.date}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                title={`${formatChartDate(d.date)}: ${formatPeso(earnings)} · ${d.orders} orders`}
              >
                <span className="hidden text-[10px] font-medium text-slate-700 sm:block sm:text-xs">
                  {earnings > 0 ? formatPeso(earnings, true) : '—'}
                </span>
                <div
                  className={`w-full rounded-t transition-all ${
                    hasOrders ? 'bg-primary/85' : 'bg-slate-200'
                  }`}
                  style={{ height: `${height}px` }}
                />
                <span className="text-[10px] font-medium text-slate-600">{formatChartDay(d.date)}</span>
                <span className="hidden text-[10px] text-muted-foreground sm:inline">{d.orders} ord.</span>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

function DailyTable({
  daily,
  weekOrders,
  totalWeek,
}: {
  daily: PartnerRevenueData['daily'];
  weekOrders: number;
  totalWeek: number;
}) {
  return (
    <div className="section-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table" style={{ minWidth: 'unset' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Orders</th>
              <th className="text-right">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {[...daily].reverse().map((d) => (
              <tr key={d.date}>
                <td className="text-slate-900">{formatChartDate(d.date)}</td>
                <td className="text-muted">{d.orders}</td>
                <td className="text-right font-medium text-slate-900">{formatPeso(d.payout ?? d.revenue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/60 bg-slate-50/80 font-medium">
              <td className="text-slate-900">7-day total</td>
              <td className="text-muted">{weekOrders}</td>
              <td className="text-right text-accent">{formatPeso(totalWeek)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function BranchBreakdownTable({ byBranch }: { byBranch: NonNullable<PartnerRevenueData['byBranch']> }) {
  return (
    <div>
      <h3 className="font-medium text-slate-900">By branch (month to date)</h3>
      <p className="mt-1 text-sm text-muted">Same month total above, split out per branch you own.</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted/60 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Branch</th>
              <th className="px-3 py-2 text-right">Orders</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Payout</th>
            </tr>
          </thead>
          <tbody>
            {byBranch.map((b) => (
              <tr key={b.branchId} className="border-t border-border">
                <td className="px-3 py-2">
                  {b.branchName} <span className="text-muted-foreground">({b.branchCode})</span>
                </td>
                <td className="px-3 py-2 text-right">{b.monthOrders}</td>
                <td className="px-3 py-2 text-right">{formatPeso(b.monthRevenue)}</td>
                <td className="px-3 py-2 text-right">{formatPeso(b.monthPayout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompletedOrdersTable({
  recentOrdersCount,
  filteredOrders,
  paymentFilter,
  onPaymentFilterChange,
}: {
  recentOrdersCount: number;
  filteredOrders: PartnerOrderDetail[];
  paymentFilter: 'all' | 'CASH' | 'digital';
  onPaymentFilterChange: (filter: 'all' | 'CASH' | 'digital') => void;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Completed orders</h3>
          <p className="mt-0.5 text-sm text-muted">Payment method and cash collection status per order</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'CASH', 'digital'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onPaymentFilterChange(f)}
              className={paymentFilter === f ? 'btn-sm bg-primary text-white' : 'btn-outline btn-sm'}
            >
              {f === 'all' ? 'All' : f === 'CASH' ? 'Cash' : 'Digital'}
            </button>
          ))}
        </div>
      </div>

      <div className="section-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Completed</th>
                <th>Order ID</th>
                <th>Payment</th>
                <th>Cash status</th>
                <th className="text-right">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted">
                    No orders match this filter
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.orderId}>
                    <td className="text-muted text-sm">
                      {o.completedAt
                        ? new Date(o.completedAt).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="font-mono text-xs text-muted">{o.orderId.slice(-8).toUpperCase()}</td>
                    <td>
                      <PaymentBadge method={o.paymentMethod} cashCollected={o.cashCollected} />
                    </td>
                    <td className="text-sm">
                      {o.paymentMethod === 'CASH' ? (
                        o.cashCollected ? (
                          <span className="text-green-700">
                            Collected
                            {o.cashTiming ? ` at ${o.cashTiming}` : ''}
                            {o.cashCollectedAt
                              ? ` · ${new Date(o.cashCollectedAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
                              : ''}
                          </span>
                        ) : (
                          <span className="text-amber-600">Pending collection</span>
                        )
                      ) : (
                        <span className="text-muted">N/A</span>
                      )}
                    </td>
                    <td className="text-right font-semibold text-slate-900">
                      {formatPeso(o.partnerPayout ?? o.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Showing most recent {recentOrdersCount} completed orders.{' '}
        <Link href="/settlements" className="underline hover:text-primary">
          View settlements →
        </Link>
      </p>
    </div>
  );
}

export default function RevenuePage() {
  const { ready } = useRequirePartner();
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'CASH' | 'digital'>('all');
  const [activeTab, setActiveTab] = useState<RevenueTab>('overview');

  const load = useCallback(async () => {
    return partnerFetch<PartnerRevenueData>('/partner/revenue');
  }, []);

  const { data, loading, error, reload } = usePartnerQuery(load, []);

  const chart = useMemo(() => {
    if (!data?.daily.length) return { maxRevenue: 1, totalWeek: 0, bestDay: null as string | null };
    const maxRevenue = Math.max(...data.daily.map((d) => d.payout ?? d.revenue), 1);
    const totalWeek = data.daily.reduce((s, d) => s + (d.payout ?? d.revenue), 0);
    const best = [...data.daily].sort((a, b) => (b.payout ?? b.revenue) - (a.payout ?? a.revenue))[0];
    return { maxRevenue, totalWeek, bestDay: best?.date ?? null };
  }, [data]);

  const filteredOrders = useMemo((): PartnerOrderDetail[] => {
    if (!data?.recentOrders) return [];
    if (paymentFilter === 'all') return data.recentOrders;
    if (paymentFilter === 'CASH') return data.recentOrders.filter((o) => o.paymentMethod === 'CASH');
    return data.recentOrders.filter((o) => o.paymentMethod !== 'CASH');
  }, [data, paymentFilter]);

  if (!ready) return <AuthLoading message="Loading revenue…" />;

  const hasBranches = !!data?.byBranch?.length;
  const hasOrders = !!data?.recentOrders?.length;

  const tabs: { id: RevenueTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(hasBranches ? [{ id: 'branches' as const, label: 'By branch' }] : []),
    ...(hasOrders ? [{ id: 'orders' as const, label: 'Completed orders' }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Revenue"
        description="Your earnings from completed orders. Amounts reflect your payout after Lunara processing."
        actions={
          <>
            <button type="button" className="btn-outline btn-sm" onClick={() => reload()}>
              Refresh
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!data}
              onClick={() => {
                if (!data) return;
                exportCsv(
                  'revenue-daily.csv',
                  ['Date', 'Revenue (₱)', 'Payout (₱)', 'Orders'],
                  data.daily.map((d) => [d.date, d.revenue, d.payout ?? d.revenue, d.orders]),
                );
              }}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!data}
              onClick={() => {
                if (!data) return;
                exportPdf(
                  'revenue-daily.pdf',
                  ['Date', 'Revenue (₱)', 'Payout (₱)', 'Orders'],
                  data.daily.map((d) => [d.date, d.revenue, d.payout ?? d.revenue, d.orders]),
                  'Daily revenue',
                );
              }}
            >
              Export PDF
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
          <StatCards data={data} />

          {tabs.length > 1 && (
            <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-slate-50 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-1 ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-muted hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="mt-6 space-y-8">
              <DailyChart
                daily={data.daily}
                maxRevenue={chart.maxRevenue}
                totalWeek={chart.totalWeek}
                bestDay={chart.bestDay}
              />
              <DailyTable daily={data.daily} weekOrders={data.weekOrders} totalWeek={chart.totalWeek} />
            </div>
          )}

          {activeTab === 'branches' && hasBranches && (
            <div className="mt-6">
              <BranchBreakdownTable byBranch={data.byBranch!} />
            </div>
          )}

          {activeTab === 'orders' && hasOrders && (
            <div className="mt-6">
              <CompletedOrdersTable
                recentOrdersCount={data.recentOrders.length}
                filteredOrders={filteredOrders}
                paymentFilter={paymentFilter}
                onPaymentFilterChange={setPaymentFilter}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
