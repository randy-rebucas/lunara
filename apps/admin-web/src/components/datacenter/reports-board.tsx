'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { adminFetch } from '../../lib/admin-api';
import { formatSlugLabel } from '../../lib/format-label';
import { formatPeso, formatPesoWhole } from '../../lib/format-peso';
import { useAdminQuery } from '../../lib/use-admin-query';

interface ReportData {
  periodDays: number;
  from?: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  averageOrderValue: number;
  newCustomers: number;
  ridersJoined: number;
  ordersByStatus: Record<string, number>;
  ordersByService: Record<string, number>;
}

type ReportState = 'nominal' | 'attention';

const PERIOD_OPTIONS = [7, 14, 30] as const;

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/revenue', label: 'Revenue' },
  { href: '/orders', label: 'Orders' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/riders', label: 'Riders' },
] as const;

const reportCopy: Record<
  ReportState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Period activity healthy',
    detail: 'Orders completing with acceptable cancellation rate for the window.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Period needs review',
    detail: 'Low volume, weak completion rate, or elevated cancellations in this window.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
};

function deriveReportState(report: ReportData): ReportState {
  if (report.totalOrders === 0) return 'attention';
  const completionRate = report.completedOrders / report.totalOrders;
  const cancelRate = report.cancelledOrders / report.totalOrders;
  if (completionRate < 0.5 || cancelRate > 0.2) return 'attention';
  return 'nominal';
}

function statusBadgeClass(status: string) {
  if (status === 'completed' || status === 'delivered') return 'badge-accent';
  if (status === 'pending_dispatch') return 'badge-warning';
  if (status.includes('cancel') || status === 'refunded') return 'badge-neutral';
  if (status.includes('rider') || status.includes('pickup') || status.includes('delivery')) {
    return 'badge-primary';
  }
  return 'badge-neutral';
}

function sortedEntries(data: Record<string, number>) {
  return Object.entries(data).sort((a, b) => b[1] - a[1]);
}

// ── Stat tiles ─────────────────────────────────────────────────────────────
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
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  href?: string;
}) {
  const cls = `rounded-xl p-4 ring-1 ${TILE_TONES[tone]}`;
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className={`${cls} block transition-all hover:shadow-[var(--shadow-elevated)]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function ShareBar({ value }: { value: number }) {
  return (
    <div className="ml-auto mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function formatPeriodFrom(from?: string) {
  if (!from) return null;
  return new Date(from).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ReportsBoard() {
  const [days, setDays] = useState<number>(7);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const data = await adminFetch<ReportData>(`/admin/reports?days=${days}`);
    setLastUpdated(new Date());
    return data;
  }, [days]);

  const { data: report, loading, error, reload } = useAdminQuery(load, [days]);

  const completionRate = report && report.totalOrders > 0
    ? Math.round((report.completedOrders / report.totalOrders) * 100)
    : 0;
  const cancelRate = report && report.totalOrders > 0
    ? Math.round((report.cancelledOrders / report.totalOrders) * 100)
    : 0;
  const inFlight = report
    ? Math.max(0, report.totalOrders - report.completedOrders - report.cancelledOrders)
    : 0;

  const statusRows = useMemo(() => {
    if (!report) return [];
    const total = report.totalOrders || 1;
    return sortedEntries(report.ordersByStatus).map(([status, count]) => ({
      status,
      count,
      share: Math.round((count / total) * 100),
    }));
  }, [report]);

  const serviceRows = useMemo(() => {
    if (!report) return [];
    const total = report.completedOrders || 1;
    return sortedEntries(report.ordersByService).map(([service, count]) => ({
      service,
      count,
      share: Math.round((count / total) * 100),
    }));
  }, [report]);

  const reportState = report ? deriveReportState(report) : 'nominal';
  const copy = reportCopy[reportState];
  const periodFrom = formatPeriodFrom(report?.from);

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
              Reports
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Platform analytics for a rolling window — orders, revenue, growth, and mix. For live
              revenue see{' '}
              <Link href="/revenue" className="link-primary">
                Revenue
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border border-border/80 bg-surface p-0.5" role="group" aria-label="Report period">
              {PERIOD_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${days === d ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-slate-900'}`}
                  aria-pressed={days === d}
                >
                  {d}d
                </button>
              ))}
            </div>
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
            <Link href="/revenue" className="btn-primary btn-sm">
              Live revenue
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !report ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading report…
        </div>
      ) : null}

      {report ? (
        <div className="space-y-3">
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">
                Last {report.periodDays} days{periodFrom ? ` · from ${periodFrom}` : ''} · {copy.detail}
              </p>
            </div>
            {report.totalOrders > 0 ? (
              <span className="badge-accent px-3 py-1 text-xs font-semibold">
                {completionRate}% completed
              </span>
            ) : null}
            {cancelRate > 0 ? (
              <span
                className={`px-3 py-1 text-xs font-semibold ${cancelRate > 20 ? 'badge-warning' : 'badge-neutral'}`}
              >
                {cancelRate}% cancelled
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <StatTile label="Total orders" value={report.totalOrders.toLocaleString()} tone="primary" href="/orders" />
            <StatTile
              label="Completed"
              value={report.completedOrders.toLocaleString()}
              sub={`${completionRate}% of period`}
              tone="accent"
            />
            <StatTile
              label="In flight"
              value={inFlight.toLocaleString()}
              sub="not completed/cancelled"
              tone="primary"
            />
            <StatTile
              label="Cancelled"
              value={report.cancelledOrders.toLocaleString()}
              tone={report.cancelledOrders > 0 ? 'amber' : 'secondary'}
            />
            <StatTile
              label="Revenue"
              value={formatPesoWhole(report.revenue)}
              tone="accent"
              href="/revenue"
            />
            <StatTile
              label="Avg order"
              value={report.completedOrders > 0 ? formatPeso(report.averageOrderValue) : '—'}
              tone="secondary"
            />
            <StatTile
              label="New customers"
              value={report.newCustomers.toLocaleString()}
              sub={`${report.ridersJoined} riders joined`}
              tone="violet"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="dc-chip rounded-md border border-border/80 bg-surface px-3 py-1.5 transition-colors hover:border-primary/40 hover:text-primary"
              >
                {a.label}
              </Link>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="dc-panel" id="report-status">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Orders by status</h2>
                <p className="text-xs text-muted">
                  {report.totalOrders} orders created in period
                </p>
              </div>

              {statusRows.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">No orders in this period</p>
                  <p className="mt-1 text-sm text-muted">Try a longer window or check order flow.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[400px]">
                    <caption className="sr-only">Orders by status for report period</caption>
                    <thead>
                      <tr>
                        <th scope="col">Status</th>
                        <th scope="col" className="text-right">
                          Count
                        </th>
                        <th scope="col" className="text-right">
                          Share
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusRows.map((row) => (
                        <tr key={row.status}>
                          <td>
                            <span className={`${statusBadgeClass(row.status)} capitalize`}>
                              {formatSlugLabel(row.status)}
                            </span>
                          </td>
                          <td className="text-right tabular-nums">{row.count}</td>
                          <td className="text-right">
                            <span className="tabular-nums text-muted">{row.share}%</span>
                            <ShareBar value={row.share} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="dc-panel" id="report-services">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Completed by service</h2>
                <p className="text-xs text-muted">
                  {report.completedOrders} completed orders in period
                </p>
              </div>

              {serviceRows.length === 0 ? (
                <div className="dc-panel-empty">
                  <p className="font-medium text-slate-900">No completed orders</p>
                  <p className="mt-1 text-sm text-muted">
                    Service mix appears when orders complete in the window.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[400px]">
                    <caption className="sr-only">Completed orders by service for report period</caption>
                    <thead>
                      <tr>
                        <th scope="col">Service</th>
                        <th scope="col" className="text-right">
                          Count
                        </th>
                        <th scope="col" className="text-right">
                          Share
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceRows.map((row) => (
                        <tr key={row.service}>
                          <td className="font-medium capitalize">{formatSlugLabel(row.service)}</td>
                          <td className="text-right tabular-nums">{row.count}</td>
                          <td className="text-right">
                            <span className="tabular-nums text-muted">{row.share}%</span>
                            <ShareBar value={row.share} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

        </div>
      ) : null}
    </div>
  );
}
