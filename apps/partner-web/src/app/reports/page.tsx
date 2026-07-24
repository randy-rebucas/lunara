'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { PartnerReportData } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useRequirePartner } from '../../hooks/use-protected-page';
import { formatPeso } from '../../lib/format-peso';
import { exportCsv } from '../../lib/export-csv';
import { exportPdf } from '../../lib/export-pdf';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

function sortedEntries(data: Record<string, number>) {
  return Object.entries(data).sort((a, b) => b[1] - a[1]);
}

function reportRows(report: PartnerReportData): (string | number)[][] {
  return [
    ['Total orders', report.totalOrders],
    ['Completed orders', report.completedOrders],
    ['Total revenue (₱)', report.revenue],
    ['Total payout (₱)', report.payout],
    ['Avg order value (₱)', report.averageOrderValue],
    ...Object.entries(report.ordersByStatus ?? {}).map(([k, v]) => [`Status: ${k}`, v] as [string, number]),
    ...Object.entries(report.completedByService ?? {}).map(([k, v]) => [`Service: ${k}`, v] as [string, number]),
  ];
}

function ReportList({
  title,
  description,
  data,
  emptyLabel,
}: {
  title: string;
  description?: string;
  data: Record<string, number>;
  emptyLabel: string;
}) {
  const entries = sortedEntries(data);
  return (
    <Card>
      <CardBody>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <ul className="mt-4 space-y-2 text-sm">
          {entries.length === 0 && <li className="text-muted">{emptyLabel}</li>}
          {entries.map(([key, count]) => (
            <li key={key} className="flex justify-between gap-4 capitalize">
              <span className="text-muted">{key.replace(/_/g, ' ')}</span>
              <span className="shrink-0 font-medium text-slate-900">{count}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export default function ReportsPage() {
  const { ready } = useRequirePartner();
  const [days, setDays] = useState(7);

  const load = useCallback(async () => {
    return partnerFetch<PartnerReportData>(`/partner/reports?days=${days}`);
  }, [days]);

  const { data: report, loading, error, reload } = usePartnerQuery(load, [days]);

  const completionRate = useMemo(() => {
    if (!report || report.totalOrders === 0) return 0;
    return Math.round((report.completedOrders / report.totalOrders) * 100);
  }, [report]);

  if (!ready) return <AuthLoading message="Loading reports…" />;

  return (
    <div>
      <PageHeader
        title="Operational reports"
        description="Order volume and revenue for your shop over the selected period."
        actions={
          <>
            <button type="button" className="btn-outline btn-sm" onClick={() => reload()}>
              Refresh
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!report}
              onClick={() => {
                if (!report) return;
                exportCsv(`report-${days}d.csv`, ['Metric', 'Value'], reportRows(report));
              }}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={!report}
              onClick={() => {
                if (!report) return;
                exportPdf(
                  `report-${days}d.pdf`,
                  ['Metric', 'Value'],
                  reportRows(report),
                  `Operational report — last ${days} days`,
                );
              }}
            >
              Export PDF
            </button>
            <Link href="/revenue" className="btn-outline btn-sm">
              Revenue →
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={days === d ? 'filter-chip-active' : 'filter-chip'}
          >
            {d} days
          </button>
        ))}
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading report…" />
      </div>

      {report && (
        <>
          <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="stat-card">
              <p className="text-xs text-muted">Total orders (updated)</p>
              <p className="text-2xl font-semibold text-slate-900">{report.totalOrders}</p>
            </div>
            <div className="stat-card !border-accent/30 !bg-accent/5">
              <p className="text-xs text-muted">Completed</p>
              <p className="text-2xl font-semibold text-accent">{report.completedOrders}</p>
              <p className="mt-1 text-xs text-muted-foreground">{completionRate}% completion rate</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">Earnings (completed)</p>
              <p className="text-2xl font-semibold text-slate-900">{formatPeso(report.payout ?? report.revenue)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">Avg order value</p>
              <p className="text-2xl font-semibold text-slate-900">
                {report.completedOrders > 0 ? formatPeso(report.averageOrderValue) : '—'}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <ReportList
              title="Orders by status"
              description="All orders touched in this period, grouped by current status."
              data={report.ordersByStatus}
              emptyLabel="No order activity in this period."
            />
            <ReportList
              title="Completed by service"
              description="Finished orders broken down by booking type."
              data={report.completedByService}
              emptyLabel="No completed orders in this period."
            />
          </div>

          {report.byBranch && report.byBranch.length > 0 && (
            <div className="mt-8">
              <h3 className="font-medium text-slate-900">By branch</h3>
              <p className="mt-1 text-sm text-muted">
                Same totals above, split out per branch you own.
              </p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted/60 text-left text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Branch</th>
                      <th className="px-3 py-2 text-right">Orders</th>
                      <th className="px-3 py-2 text-right">Completed</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                      <th className="px-3 py-2 text-right">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byBranch.map((b) => (
                      <tr key={b.branchId} className="border-t border-border">
                        <td className="px-3 py-2">
                          {b.branchName} <span className="text-muted-foreground">({b.branchCode})</span>
                        </td>
                        <td className="px-3 py-2 text-right">{b.totalOrders}</td>
                        <td className="px-3 py-2 text-right">{b.completedOrders}</td>
                        <td className="px-3 py-2 text-right">{formatPeso(b.revenue)}</td>
                        <td className="px-3 py-2 text-right">{formatPeso(b.payout)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
