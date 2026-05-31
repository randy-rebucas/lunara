'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody, StatCard } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
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
      <PageHeader title="Reports" description="Operational summary for the selected period." />

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
            <StatCard label="Avg order value" value={`₱${report.averageOrderValue}`} accent="secondary" />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ReportList title="Orders by status" data={report.ordersByStatus} />
            <ReportList title="Completed by service" data={report.completedByService} />
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
