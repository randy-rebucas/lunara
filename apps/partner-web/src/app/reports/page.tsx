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
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

function sortedEntries(data: Record<string, number>) {
  return Object.entries(data).sort((a, b) => b[1] - a[1]);
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
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <p className="text-xs text-muted">Revenue (completed)</p>
              <p className="text-2xl font-semibold text-slate-900">{formatPeso(report.revenue)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted">Avg order value</p>
              <p className="text-2xl font-semibold text-slate-900">
                {report.completedOrders > 0 ? formatPeso(report.averageOrderValue) : '—'}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
        </>
      )}
    </div>
  );
}
