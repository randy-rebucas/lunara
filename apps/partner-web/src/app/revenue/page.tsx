'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../../components/data-page-status';
import { Card, CardBody, StatCard } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { isPartnerRole, partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface RevenueData {
  today: number;
  month: number;
  todayOrders: number;
  monthOrders: number;
  allTimeCompletedOrders: number;
  daily: { date: string; revenue: number; orders: number }[];
}

export default function RevenuePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isPartnerRole()) router.replace('/orders');
  }, [router]);

  const load = useCallback(async () => {
    if (!isPartnerRole()) return null as unknown as RevenueData;
    return partnerFetch<RevenueData>('/partner/revenue');
  }, []);

  const { data, loading, error } = usePartnerQuery(load, []);

  if (!isPartnerRole()) return null;

  if (loading || error || !data) {
    return (
      <div>
        <PageHeader title="Revenue" description="Today, month-to-date, and last 7 days." />
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading revenue…" />
      </div>
    );
  }

  const maxDaily = Math.max(...data.daily.map((d) => d.revenue), 1);

  return (
    <div>
      <PageHeader title="Revenue" description="Today, month-to-date, and last 7 days." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Today" value={`₱${data.today.toFixed(2)}`} accent="accent" />
        <StatCard label="This month" value={`₱${data.month.toFixed(2)}`} />
        <StatCard label="All-time completed" value={data.allTimeCompletedOrders} accent="secondary" />
      </div>
      <div className="mt-2 grid gap-4 text-xs text-muted-foreground sm:grid-cols-2">
        <p>{data.todayOrders} orders today</p>
        <p>{data.monthOrders} orders this month</p>
      </div>

      <Card className="mt-10">
        <CardBody>
          <h3 className="font-semibold text-slate-900">Last 7 days</h3>
          <div className="mt-6 flex items-end gap-2" style={{ minHeight: 160 }}>
            {data.daily.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-medium text-slate-700">₱{d.revenue.toFixed(0)}</span>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${Math.max(8, (d.revenue / maxDaily) * 120)}px` }}
                  title={`${d.orders} orders`}
                />
                <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
