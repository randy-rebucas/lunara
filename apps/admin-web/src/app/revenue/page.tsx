'use client';

import { useCallback } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/stat-card';
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

export default function MonitorRevenuePage() {
  const load = useCallback(() => adminFetch<RevenueData>('/admin/revenue'), []);
  const { data, loading, error } = useAdminQuery(load, []);

  const maxDaily = data ? Math.max(...data.daily.map((d) => d.revenue), 1) : 1;

  return (
    <div>
      <PageHeader title="Revenue" description="Platform-wide completed order revenue." />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading revenue…" />

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Today" value={formatPeso(data.today)} accent="accent" />
            <StatCard label="This month" value={formatPeso(data.month)} />
            <StatCard
              label="All-time completed"
              value={data.allTimeCompleted.toLocaleString()}
              accent="secondary"
            />
          </div>
          <p className="mt-3 text-sm text-muted">
            {data.todayOrders} orders today · {data.monthOrders} orders this month
          </p>

          <Card className="mt-10">
            <CardBody>
              <h3 className="font-semibold text-slate-900">Last 7 days</h3>
              <div className="mt-6 flex items-end gap-2" style={{ minHeight: 140 }}>
                {data.daily.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-medium text-slate-700">
                      {formatPesoWhole(d.revenue)}
                    </span>
                    <div
                      className="w-full rounded-t bg-primary"
                      style={{ height: `${Math.max(8, (d.revenue / maxDaily) * 100)}px` }}
                      title={`${d.orders} orders`}
                    />
                    <span className="text-[10px] text-muted">{formatChartDay(d.date)}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="mt-8">
            <CardBody>
              <h3 className="font-semibold text-slate-900">Revenue by service (MTD)</h3>
              {data.byService.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No completed orders this month yet.</p>
              ) : (
                <ul className="mt-4 space-y-2 text-sm">
                  {data.byService.map((s) => (
                    <li key={s.service} className="flex justify-between capitalize">
                      <span className="text-muted">{formatSlugLabel(s.service)}</span>
                      <span className="font-medium text-slate-900">
                        {formatPesoWhole(s.revenue)} ({s.count})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
