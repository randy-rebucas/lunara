'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { DataPageStatus } from '../components/data-page-status';
import { adminFetch } from '../lib/admin-api';
import { useAdminQuery } from '../lib/use-admin-query';

interface DashboardData {
  counts: {
    activeOrders: number;
    ordersToday: number;
    ridersOnline: number;
    totalRiders: number;
    partners: number;
    staff: number;
    customers: number;
    openTickets: number;
    activePromos: number;
    pendingDispatch: number;
  };
  revenue: { month: number; monthOrders: number };
  recentOrders: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
  }[];
}

export default function AdminOverviewPage() {
  const load = useCallback(() => adminFetch<DashboardData>('/admin/dashboard'), []);
  const { data, loading, error } = useAdminQuery(load, []);

  if (loading || error || !data) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Overview dashboard</h2>
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading overview…" />
      </div>
    );
  }

  const stats = [
    { label: 'New orders queue', value: data.counts.pendingDispatch, href: '/dispatch' },
    { label: 'Active orders', value: data.counts.activeOrders, href: '/orders' },
    { label: 'Orders today', value: data.counts.ordersToday, href: '/orders' },
    { label: 'Riders online', value: `${data.counts.ridersOnline}/${data.counts.totalRiders}`, href: '/riders' },
    { label: 'Laundry shops', value: data.counts.partners, href: '/shops' },
    { label: 'Open tickets', value: data.counts.openTickets, href: '/support' },
    { label: 'Revenue (MTD)', value: `₱${data.revenue.month.toFixed(0)}`, href: '/revenue' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900">Overview dashboard</h2>
      <p className="mt-1 text-sm text-slate-500">
        Login → overview → orders → riders → shops → revenue → support → reports → promotions
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl bg-white p-6 shadow-sm transition hover:ring-2 hover:ring-indigo-200"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <MiniStat label="Customers" value={data.counts.customers} />
        <MiniStat label="Staff" value={data.counts.staff} />
        <MiniStat label="Active promos" value={data.counts.activePromos} />
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recent orders</h3>
          <Link href="/orders" className="text-sm text-indigo-600">
            Monitor all →
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {data.recentOrders.length === 0 && (
            <p className="text-sm text-slate-500">No recent orders.</p>
          )}
          {data.recentOrders.map((o) => (
            <Link
              key={o._id}
              href={`/orders/${o._id}`}
              className="flex justify-between rounded-lg border bg-white px-4 py-3 hover:border-indigo-300"
            >
              <div>
                <p className="font-medium capitalize">{o.bookingType.replace(/_/g, ' ')}</p>
                <p className="text-sm capitalize text-slate-500">{o.status.replace(/_/g, ' ')}</p>
              </div>
              <p className="font-medium">₱{o.total}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
