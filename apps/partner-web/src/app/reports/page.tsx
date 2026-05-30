'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../../components/data-page-status';
import { isPartnerRole, partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface ReportData {
  periodDays: number;
  from: string;
  totalOrders: number;
  completedOrders: number;
  revenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  completedByService: Record<string, number>;
}

export default function ReportsPage() {
  const router = useRouter();
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!isPartnerRole()) router.replace('/orders');
  }, [router]);

  const load = useCallback(async () => {
    if (!isPartnerRole()) return null as unknown as ReportData;
    return partnerFetch<ReportData>(`/partner/reports?days=${days}`);
  }, [days]);

  const { data: report, loading, error } = usePartnerQuery(load, [days]);

  if (!isPartnerRole()) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold">Generate reports</h2>
      <p className="mt-1 text-sm text-slate-500">Operational summary for the selected period.</p>

      <div className="mt-4 flex gap-2">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-lg px-4 py-2 text-sm ${
              days === d ? 'bg-primary text-white' : 'border bg-white text-slate-600'
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
            <Metric label="Avg order value" value={`₱${report.averageOrderValue}`} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border bg-white p-6">
              <h3 className="font-semibold">Orders by status</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {Object.entries(report.ordersByStatus).map(([status, count]) => (
                  <li key={status} className="flex justify-between capitalize">
                    <span>{status.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border bg-white p-6">
              <h3 className="font-semibold">Completed by service</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {Object.entries(report.completedByService).map(([type, count]) => (
                  <li key={type} className="flex justify-between capitalize">
                    <span>{type.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
