'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { DataPageStatus } from '../components/data-page-status';
import { PriorityAlerts } from '../components/priority-alerts';
import { EmptyState } from '../components/empty-state';
import { PageHeader } from '../components/ui/page-header';
import { SectionHeading } from '../components/ui/section-heading';
import { StatCard } from '../components/ui/stat-card';
import { adminFetch } from '../lib/admin-api';
import { formatSlugLabel } from '../lib/format-label';
import { formatPeso } from '../lib/format-peso';
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

  const alerts = useMemo(() => {
    if (!data) return [];
    const list: { label: string; href: string; tone: 'amber' | 'red' | 'primary' }[] = [];
    if (data.counts.pendingDispatch > 0) {
      list.push({
        label: `${data.counts.pendingDispatch} order${data.counts.pendingDispatch === 1 ? '' : 's'} in dispatch queue`,
        href: '/dispatch',
        tone: 'amber',
      });
    }
    if (data.counts.openTickets > 0) {
      list.push({
        label: `${data.counts.openTickets} open support ticket${data.counts.openTickets === 1 ? '' : 's'}`,
        href: '/support',
        tone: 'primary',
      });
    }
    return list;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Platform snapshot — orders, riders, revenue, and support at a glance."
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading overview…" />

      {data ? (
        <>
          <PriorityAlerts items={alerts} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StatCard
              label="New orders queue"
              value={data.counts.pendingDispatch}
              href="/dispatch"
              accent="warning"
            />
            <StatCard label="Active orders" value={data.counts.activeOrders} href="/orders" />
            <StatCard label="Orders today" value={data.counts.ordersToday} href="/orders" />
            <StatCard
              label="Riders online"
              value={`${data.counts.ridersOnline}/${data.counts.totalRiders}`}
              href="/riders"
              accent="accent"
            />
            <StatCard
              label="Laundry shops"
              value={data.counts.partners}
              href="/shops"
              accent="secondary"
            />
            <StatCard label="Open tickets" value={data.counts.openTickets} href="/support" />
            <StatCard
              label="Revenue (MTD)"
              value={formatPeso(data.revenue.month, true)}
              href="/revenue"
            />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Customers" value={data.counts.customers} />
            <StatCard label="Staff" value={data.counts.staff} />
            <StatCard label="Active promos" value={data.counts.activePromos} href="/promotions" />
          </div>

          <p className="mt-6 text-xs text-muted">
            {data.revenue.monthOrders} completed order{data.revenue.monthOrders === 1 ? '' : 's'} this month
          </p>

          <section className="mt-10">
            <SectionHeading title="Recent orders" href="/orders" />
            {data.recentOrders.length === 0 ? (
              <EmptyState title="No recent orders" description="New bookings will appear here." />
            ) : (
              <div className="space-y-2">
                {data.recentOrders.map((o) => (
                  <Link key={o._id} href={`/orders/${o._id}`} className="list-row">
                    <div>
                      <p className="font-medium capitalize text-slate-900">
                        {formatSlugLabel(o.bookingType)}
                      </p>
                      <p className="text-sm capitalize text-muted">{formatSlugLabel(o.status)}</p>
                    </div>
                    <p className="font-semibold text-slate-900">{formatPeso(o.total)}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
