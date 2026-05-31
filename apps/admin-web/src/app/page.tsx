'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { DataPageStatus } from '../components/data-page-status';
import { PageHeader } from '../components/ui/page-header';
import { StatCard } from '../components/ui/stat-card';
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
        <PageHeader
          title="Overview"
          description="Platform snapshot — orders, riders, revenue, and support at a glance."
        />
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading overview…" />
      </div>
    );
  }

  const stats = [
    { label: 'New orders queue', value: data.counts.pendingDispatch, href: '/dispatch', accent: 'warning' as const },
    { label: 'Active orders', value: data.counts.activeOrders, href: '/orders' },
    { label: 'Orders today', value: data.counts.ordersToday, href: '/orders' },
    {
      label: 'Riders online',
      value: `${data.counts.ridersOnline}/${data.counts.totalRiders}`,
      href: '/riders',
      accent: 'accent' as const,
    },
    { label: 'Laundry shops', value: data.counts.partners, href: '/shops', accent: 'secondary' as const },
    { label: 'Open tickets', value: data.counts.openTickets, href: '/support' },
    { label: 'Revenue (MTD)', value: `₱${data.revenue.month.toFixed(0)}`, href: '/revenue' },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Platform snapshot — orders, riders, revenue, and support at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Customers" value={data.counts.customers} />
        <StatCard label="Staff" value={data.counts.staff} />
        <StatCard label="Active promos" value={data.counts.activePromos} href="/promotions" />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Recent orders</h3>
          <Link href="/orders" className="link-primary text-sm">
            View all →
          </Link>
        </div>
        <div className="space-y-2">
          {data.recentOrders.length === 0 && (
            <p className="text-sm text-muted">No recent orders.</p>
          )}
          {data.recentOrders.map((o) => (
            <Link key={o._id} href={`/orders/${o._id}`} className="list-row">
              <div>
                <p className="font-medium capitalize text-slate-900">{o.bookingType.replace(/_/g, ' ')}</p>
                <p className="text-sm capitalize text-muted">{o.status.replace(/_/g, ' ')}</p>
              </div>
              <p className="font-semibold text-slate-900">₱{o.total}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
