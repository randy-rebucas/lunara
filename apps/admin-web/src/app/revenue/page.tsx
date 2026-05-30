'use client';

import { useCallback } from 'react';
import { DataPageStatus } from '../../components/data-page-status';
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
        <h2 className="text-2xl font-bold">Monitor revenue</h2>
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading revenue…" />
      </div>
    );
  }

  const maxDaily = Math.max(...data.daily.map((d) => d.revenue), 1);

  return (
    <div>
      <h2 className="text-2xl font-bold">Monitor revenue</h2>
      <p className="mt-1 text-sm text-slate-500">Platform-wide completed order revenue.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Today</p>
          <p className="mt-1 text-3xl font-bold text-green-600">₱{data.today.toFixed(2)}</p>
          <p className="text-xs text-slate-400">{data.todayOrders} orders</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">This month</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">₱{data.month.toFixed(2)}</p>
          <p className="text-xs text-slate-400">{data.monthOrders} orders</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">All-time completed</p>
          <p className="mt-1 text-3xl font-bold">{data.allTimeCompleted}</p>
        </div>
      </div>

      <section className="mt-10 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold">Last 7 days</h3>
        <div className="mt-6 flex items-end gap-2" style={{ minHeight: 140 }}>
          {data.daily.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium">₱{d.revenue.toFixed(0)}</span>
              <div
                className="w-full rounded-t bg-indigo-500"
                style={{ height: `${Math.max(8, (d.revenue / maxDaily) * 100)}px` }}
              />
              <span className="text-[10px] text-slate-500">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold">Revenue by service (MTD)</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {data.byService.map((s) => (
            <li key={s.service} className="flex justify-between capitalize">
              <span>{s.service.replace(/_/g, ' ')}</span>
              <span>
                ₱{s.revenue.toFixed(0)} ({s.count})
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
