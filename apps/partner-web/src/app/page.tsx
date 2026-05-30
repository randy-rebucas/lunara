'use client';

import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../components/data-page-status';
import { isPartnerRole, partnerFetch } from '../lib/partner-api';
import { usePartnerQuery } from '../lib/use-partner-query';

interface DashboardData {
  counts: {
    incoming: number;
    inProcessing: number;
    readyForDelivery: number;
    completedToday: number;
    staffMembers: number;
    lowStockItems: number;
  };
  revenue: { today: number; week: number; todayOrders: number; weekOrders: number };
  recentOrders: {
    _id: string;
    bookingType: string;
    status: string;
    total: number;
    assignedStaffEmail?: string;
  }[];
}

export default function PartnerDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isPartnerRole()) router.replace('/orders');
  }, [router]);

  const load = useCallback(async () => {
    if (!isPartnerRole()) return null as unknown as DashboardData;
    return partnerFetch<DashboardData>('/partner/dashboard');
  }, []);

  const { data, loading, error } = usePartnerQuery(load, []);

  if (!isPartnerRole()) return null;

  if (loading || error || !data) {
    return (
      <div>
        <h2 className="text-2xl font-bold">Shop dashboard</h2>
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading dashboard…" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold">Shop dashboard</h2>
      <p className="mt-1 text-sm text-slate-500">
        Login → dashboard → incoming orders → assign staff → monitor → inventory → reports → revenue
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Incoming" value={data.counts.incoming} href="/orders/incoming" />
        <StatCard label="In processing" value={data.counts.inProcessing} href="/orders/progress" />
        <StatCard label="Ready for delivery" value={data.counts.readyForDelivery} href="/orders/progress" />
        <StatCard label="Completed today" value={data.counts.completedToday} />
        <StatCard label="Staff members" value={data.counts.staffMembers} href="/staff" />
        <StatCard
          label="Low stock alerts"
          value={data.counts.lowStockItems}
          href="/inventory"
          alert={data.counts.lowStockItems > 0}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-slate-500">Revenue today</p>
          <p className="mt-1 text-3xl font-bold text-accent">₱{data.revenue.today.toFixed(2)}</p>
          <p className="text-xs text-slate-400">{data.revenue.todayOrders} orders</p>
          <Link href="/revenue" className="mt-3 inline-block text-sm text-primary">
            Monitor revenue →
          </Link>
        </div>
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-slate-500">Revenue (7 days)</p>
          <p className="mt-1 text-3xl font-bold text-primary">₱{data.revenue.week.toFixed(2)}</p>
          <p className="text-xs text-slate-400">{data.revenue.weekOrders} orders</p>
          <Link href="/reports" className="mt-3 inline-block text-sm text-primary">
            Generate reports →
          </Link>
        </div>
      </div>

      <section className="mt-10">
        <h3 className="font-semibold">Recent incoming activity</h3>
        <div className="mt-4 space-y-2">
          {data.recentOrders.length === 0 && (
            <p className="text-sm text-slate-500">No recent activity.</p>
          )}
          {data.recentOrders.map((o) => (
            <Link
              key={o._id}
              href={`/orders/${o._id}`}
              className="flex justify-between rounded-lg border bg-white p-4 hover:border-primary"
            >
              <div>
                <p className="font-medium capitalize">{o.bookingType.replace(/_/g, ' ')}</p>
                <p className="text-sm capitalize text-slate-500">
                  {o.status.replace(/_/g, ' ')}
                  {o.assignedStaffEmail ? ` · ${o.assignedStaffEmail}` : ''}
                </p>
              </div>
              <p className="font-medium">₱{o.total}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  alert,
}: {
  label: string;
  value: number;
  href?: string;
  alert?: boolean;
}) {
  const inner = (
    <div
      className={`rounded-xl border bg-white p-5 ${alert ? 'border-amber-300 bg-amber-50' : ''} ${href ? 'hover:border-primary' : ''}`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
