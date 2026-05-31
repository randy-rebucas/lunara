'use client';

import { useCallback } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/stat-card';
import { adminFetch } from '../../lib/admin-api';
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

  if (loading || error || !data) {
    return (
      <div>
        <PageHeader title="Revenue" description="Platform-wide completed order revenue." />
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading revenue…" />
      </div>
    );
  }

  const maxDaily = Math.max(...data.daily.map((d) => d.revenue), 1);

  return (
    <div>
      <PageHeader title="Revenue" description="Platform-wide completed order revenue." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Today" value={`₱${data.today.toFixed(2)}`} accent="accent" />
        <StatCard label="This month" value={`₱${data.month.toFixed(2)}`} />
        <StatCard label="All-time completed" value={data.allTimeCompleted} accent="secondary" />
      </div>
      <div className="mt-2 grid gap-4 sm:grid-cols-2 text-xs text-muted-foreground sm:grid-cols-3">
        <p>{data.todayOrders} orders today</p>
        <p>{data.monthOrders} orders this month</p>
        <p className="hidden sm:block" />
      </div>

      <Card className="mt-10">
        <CardBody>
          <h3 className="font-semibold text-slate-900">Last 7 days</h3>
          <div className="mt-6 flex items-end gap-2" style={{ minHeight: 140 }}>
            {data.daily.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-medium text-slate-700">₱{d.revenue.toFixed(0)}</span>
                <div
                  className="w-full rounded-t bg-primary"
                  style={{ height: `${Math.max(8, (d.revenue / maxDaily) * 100)}px` }}
                />
                <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="mt-8">
        <CardBody>
          <h3 className="font-semibold text-slate-900">Revenue by service (MTD)</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {data.byService.map((s) => (
              <li key={s.service} className="flex justify-between capitalize">
                <span className="text-muted">{s.service.replace(/_/g, ' ')}</span>
                <span className="font-medium text-slate-900">
                  ₱{s.revenue.toFixed(0)} ({s.count})
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
