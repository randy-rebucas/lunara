'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../../components/data-page-status';
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
        <h2 className="text-2xl font-bold">Monitor revenue</h2>
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading revenue…" />
      </div>
    );
  }

  const maxDaily = Math.max(...data.daily.map((d) => d.revenue), 1);

  return (
    <div>
      <h2 className="text-2xl font-bold">Monitor revenue</h2>
      <p className="mt-1 text-sm text-slate-500">Today, month-to-date, and last 7 days.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-slate-500">Today</p>
          <p className="mt-1 text-3xl font-bold text-accent">₱{data.today.toFixed(2)}</p>
          <p className="text-xs text-slate-400">{data.todayOrders} orders</p>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-slate-500">This month</p>
          <p className="mt-1 text-3xl font-bold text-primary">₱{data.month.toFixed(2)}</p>
          <p className="text-xs text-slate-400">{data.monthOrders} orders</p>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-slate-500">All-time completed</p>
          <p className="mt-1 text-3xl font-bold">{data.allTimeCompletedOrders}</p>
        </div>
      </div>

      <section className="mt-10 rounded-xl border bg-white p-6">
        <h3 className="font-semibold">Last 7 days</h3>
        <div className="mt-6 flex items-end gap-2" style={{ minHeight: 160 }}>
          {data.daily.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium">₱{d.revenue.toFixed(0)}</span>
              <div
                className="w-full rounded-t bg-primary/80"
                style={{ height: `${Math.max(8, (d.revenue / maxDaily) * 120)}px` }}
                title={`${d.orders} orders`}
              />
              <span className="text-[10px] text-slate-500">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
