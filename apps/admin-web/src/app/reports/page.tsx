'use client';

import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
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
      <h2 className="text-2xl font-bold">Generate reports</h2>
      <p className="mt-1 text-sm text-slate-500">Platform analytics for the selected period.</p>

      <div className="mt-4 flex gap-2">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-lg px-4 py-2 text-sm ${
              days === d ? 'bg-indigo-600 text-white' : 'border bg-white'
            }`}
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
            <Metric label="Total orders" value={String(report.totalOrders)} />
            <Metric label="Completed" value={String(report.completedOrders)} />
            <Metric label="Revenue" value={`₱${report.revenue.toFixed(2)}`} />
            <Metric label="New customers" value={String(report.newCustomers)} />
            <Metric label="Cancelled" value={String(report.cancelledOrders)} />
            <Metric label="Avg order" value={`₱${report.averageOrderValue}`} />
            <Metric label="Riders joined" value={String(report.ridersJoined)} />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ReportList({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-4 space-y-2 text-sm">
        {Object.entries(data).map(([key, count]) => (
          <li key={key} className="flex justify-between capitalize">
            <span>{key.replace(/_/g, ' ')}</span>
            <span className="font-medium">{count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
