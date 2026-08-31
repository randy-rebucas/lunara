'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { formatPeso, formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';
import { StatTile } from '../ui/stat-tile';
import { CompareLineChart, DonutChart, type DonutSegment } from './dash-charts';

interface RevenueByPlan {
  planKey: string;
  planName: string;
  revenue: number;
  subscriberCount: number;
}

interface RevenueTrendPoint {
  month: string;
  revenue: number;
}

interface StatusCounts {
  trialing: number;
  active: number;
  past_due: number;
  grace_period: number;
  suspended: number;
  cancelled: number;
  expired: number;
}

interface BillingMetrics {
  mrr: number;
  arr: number;
  statusCounts: StatusCounts;
  revenueByPlan: RevenueByPlan[];
  churnRatePercent: number;
  cancelledLast30d: number;
  revenueTrend: RevenueTrendPoint[];
}

interface StaleSubscription {
  _id: string;
  partnerId: string;
  status: string;
  currentPeriodEnd: string;
}

interface BillingReconciliation {
  staleSubscriptions: StaleSubscription[];
  subscriptionFeeDrift: { ledgerTotal: number; invoiceTotal: number; drift: number };
  webhookEvents: { total: number; processed: number; failed: number; unprocessed: number };
}

function daysOverdue(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

const STATUS_LABELS: Record<keyof StatusCounts, string> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  grace_period: 'Grace period',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const STATUS_COLORS: Record<keyof StatusCounts, string> = {
  trialing: '#6366f1',
  active: '#10b981',
  past_due: '#f59e0b',
  grace_period: '#f97316',
  suspended: '#f43f5e',
  cancelled: '#94a3b8',
  expired: '#64748b',
};

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

export function BillingMetricsBoard() {
  const load = useCallback(() => adminFetch<BillingMetrics>('/admin/billing/metrics'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);

  const loadReconciliation = useCallback(() => adminFetch<BillingReconciliation>('/admin/billing/reconciliation'), []);
  const { data: recon, reload: reloadRecon } = useAdminQuery(loadReconciliation, []);

  const chartSeries = useMemo(() => {
    const trend = data?.revenueTrend ?? [];
    return {
      labels: trend.map((t) => monthLabel(t.month)),
      series: [{ label: 'Subscription revenue', color: '#10b981', values: trend.map((t) => t.revenue) }],
    };
  }, [data]);

  const statusSegments: DonutSegment[] = useMemo(() => {
    if (!data) return [];
    return (Object.keys(STATUS_LABELS) as (keyof StatusCounts)[])
      .map((key) => ({
        key,
        label: STATUS_LABELS[key],
        count: data.statusCounts[key],
        color: STATUS_COLORS[key],
      }))
      .filter((s) => s.count > 0);
  }, [data]);

  const totalSubscriptions = data
    ? Object.values(data.statusCounts).reduce((sum, n) => sum + n, 0)
    : 0;
  const atRiskCount = data ? data.statusCounts.past_due + data.statusCounts.grace_period : 0;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Billing metrics
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Subscription revenue, plan mix, and account health across every partner on a paid or
              trial plan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => { void reload(); void reloadRecon(); }}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link href="/partners/plans" className="btn-outline btn-sm">Plans</Link>
            <Link href="/accounting" className="btn-outline btn-sm">Accounting</Link>
          </div>
        </div>
      </header>

      {error && <div className="alert-error mb-4" role="alert">{error}</div>}

      {/* ── Stat tiles ───────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="MRR" value={formatPesoWhole(data?.mrr ?? 0)} sub="active subscriptions" tone="accent" />
        <StatTile label="ARR" value={formatPesoWhole(data?.arr ?? 0)} sub="projected" tone="primary" />
        <StatTile label="Active" value={String(data?.statusCounts.active ?? 0)} sub={`of ${totalSubscriptions} total`} tone="accent" />
        <StatTile label="Trialing" value={String(data?.statusCounts.trialing ?? 0)} tone="secondary" />
        <StatTile
          label="Past due + grace"
          value={String(atRiskCount)}
          sub={atRiskCount > 0 ? 'needs attention' : undefined}
          tone={atRiskCount > 0 ? 'amber' : 'secondary'}
        />
        <StatTile
          label="Suspended"
          value={String(data?.statusCounts.suspended ?? 0)}
          tone={(data?.statusCounts.suspended ?? 0) > 0 ? 'rose' : 'secondary'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="dc-panel lg:col-span-2">
          <div className="dc-panel-header">
            <h2 className="text-sm font-semibold text-slate-900">Subscription revenue trend</h2>
            <p className="text-xs text-muted">
              Actually-recognized subscription fee revenue — last {data?.revenueTrend.length ?? 6} months
            </p>
          </div>
          <div className="dc-panel-body">
            {loading && !data ? (
              <p className="py-8 text-center text-sm text-muted">Loading trend…</p>
            ) : (data?.revenueTrend ?? []).every((t) => t.revenue === 0) ? (
              <p className="py-8 text-center text-sm text-muted">No subscription revenue posted yet.</p>
            ) : (
              <CompareLineChart
                labels={chartSeries.labels}
                series={chartSeries.series}
                formatValue={(n) => formatPeso(n, true)}
                labelEvery={1}
                ariaLabel="Subscription revenue by month"
              />
            )}
          </div>
        </section>

        <section className="dc-panel">
          <div className="dc-panel-header">
            <h2 className="text-sm font-semibold text-slate-900">Subscription status</h2>
            <p className="text-xs text-muted">{totalSubscriptions} total</p>
          </div>
          <div className="dc-panel-body">
            {statusSegments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No subscriptions yet.</p>
            ) : (
              <>
                <DonutChart
                  segments={statusSegments}
                  centerLabel="Churn (30d)"
                  centerValue={`${data?.churnRatePercent ?? 0}%`}
                />
                <div className="mt-4 space-y-2">
                  {statusSegments.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </span>
                      <span className="font-medium tabular-nums text-slate-900">{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <section className="dc-panel mt-4">
        <div className="dc-panel-header">
          <h2 className="text-sm font-semibold text-slate-900">Revenue by plan</h2>
          <p className="text-xs text-muted">Active subscriptions only</p>
        </div>
        {!data || data.revenueByPlan.length === 0 ? (
          <div className="dc-panel-empty">
            <p className="font-medium text-slate-900">No active subscriptions yet</p>
            <p className="mt-1 text-sm text-muted">Revenue by plan appears once a partner is on an active paid plan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col" className="text-right">Subscribers</th>
                  <th scope="col" className="text-right">MRR</th>
                </tr>
              </thead>
              <tbody>
                {data.revenueByPlan.map((p) => (
                  <tr key={p.planKey}>
                    <td className="font-medium text-slate-900">{p.planName}</td>
                    <td className="text-right text-muted">{p.subscriberCount}</td>
                    <td className="text-right font-medium tabular-nums text-slate-900">{formatPeso(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/60 bg-slate-50/80 font-medium">
                  <td className="text-slate-900">Total</td>
                  <td className="text-right text-muted">{data.revenueByPlan.reduce((s, p) => s + p.subscriberCount, 0)}</td>
                  <td className="text-right text-slate-900">{formatPeso(data.revenueByPlan.reduce((s, p) => s + p.revenue, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ── Reconciliation ─────────────────────────────────────── */}
      <section className="dc-panel mt-4">
        <div className="dc-panel-header">
          <h2 className="text-sm font-semibold text-slate-900">Reconciliation</h2>
          <p className="text-xs text-muted">Webhook delivery health and ledger-vs-invoice drift checks</p>
        </div>
        <div className="dc-panel-body space-y-4">
          <div
            className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${
              Math.abs(recon?.subscriptionFeeDrift.drift ?? 0) < 1
                ? 'border-emerald-500/30 bg-emerald-950/5'
                : 'border-amber-500/35 bg-amber-950/5'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                Math.abs(recon?.subscriptionFeeDrift.drift ?? 0) < 1
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
              }`}
              aria-hidden
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Subscription fee drift: {formatPesoWhole(recon?.subscriptionFeeDrift.drift ?? 0)}
              </p>
              <p className="text-xs text-muted">
                {Math.abs(recon?.subscriptionFeeDrift.drift ?? 0) < 1
                  ? 'Ledger and invoice totals match — every subscription-fee ledger post has a corresponding invoice.'
                  : 'Ledger and invoice totals disagree — investigate before this compounds.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Webhooks processed" value={String(recon?.webhookEvents.processed ?? 0)} sub="last 30 days" tone="accent" />
            <StatTile
              label="Webhooks failed"
              value={String(recon?.webhookEvents.failed ?? 0)}
              sub="last 30 days"
              tone={(recon?.webhookEvents.failed ?? 0) > 0 ? 'rose' : 'secondary'}
            />
            <StatTile
              label="Webhooks unprocessed"
              value={String(recon?.webhookEvents.unprocessed ?? 0)}
              sub="last 30 days"
              tone={(recon?.webhookEvents.unprocessed ?? 0) > 0 ? 'amber' : 'secondary'}
            />
          </div>

          {recon && recon.staleSubscriptions.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-900">
                Stale subscriptions ({recon.staleSubscriptions.length})
              </p>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Partner</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="text-right">Days overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recon.staleSubscriptions.map((s) => (
                      <tr key={s._id}>
                        <td className="font-mono text-xs text-slate-600">{s.partnerId}</td>
                        <td className="text-sm text-slate-900">{s.status}</td>
                        <td className="text-right text-sm text-amber-700">{daysOverdue(s.currentPeriodEnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
