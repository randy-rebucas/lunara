'use client';

import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { StatCard } from '../../components/ui/stat-card';
import { adminFetch } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';

interface ReportData {
  periodDays: number;
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

export default function ReportsPage() {
  const [days, setDays] = useState(7);

  const load = useCallback(
    () => adminFetch<ReportData>(`/admin/reports?days=${days}`),
    [days],
  );
  const { data: report, loading, error } = useAdminQuery(load, [days]);

  return (
    <div>
      <PageHeader title="Reports" description="Platform analytics for the selected period." />

      <div className="flex gap-2">
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
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total orders" value={report.totalOrders} />
            <StatCard label="Completed" value={report.completedOrders} accent="accent" />
            <StatCard label="Revenue" value={`₱${report.revenue.toFixed(2)}`} />
            <StatCard label="New customers" value={report.newCustomers} accent="secondary" />
            <StatCard label="Cancelled" value={report.cancelledOrders} />
            <StatCard label="Avg order" value={`₱${report.averageOrderValue}`} />
            <StatCard label="Riders joined" value={report.ridersJoined} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ReportList title="Orders by status" data={report.ordersByStatus} />
            <ReportList title="Completed by service" data={report.ordersByService} />
          </div>
        </>
      )}
    </div>
  );
}

function ReportList({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <Card>
      <CardBody>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {Object.entries(data).map(([key, count]) => (
            <li key={key} className="flex justify-between capitalize">
              <span className="text-muted">{key.replace(/_/g, ' ')}</span>
              <span className="font-medium text-slate-900">{count}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
