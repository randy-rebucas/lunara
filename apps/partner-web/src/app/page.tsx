'use client';

import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../components/data-page-status';
import { Card, CardBody, StatCard } from '../components/ui/card';
import { PageHeader } from '../components/ui/page-header';
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
        <PageHeader
          title="Dashboard"
          description="Shop snapshot — orders, staff, inventory, and revenue at a glance."
        />
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading dashboard…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Shop snapshot — orders, staff, inventory, and revenue at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Incoming" value={data.counts.incoming} href="/orders/incoming" />
        <StatCard label="In processing" value={data.counts.inProcessing} href="/orders/progress" />
        <StatCard label="Ready for delivery" value={data.counts.readyForDelivery} href="/orders/progress" />
        <StatCard label="Completed today" value={data.counts.completedToday} accent="accent" />
        <StatCard label="Staff members" value={data.counts.staffMembers} href="/staff" accent="secondary" />
        <StatCard
          label="Low stock alerts"
          value={data.counts.lowStockItems}
          href="/inventory"
          warning={data.counts.lowStockItems > 0}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-muted">Revenue today</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-accent">
              ₱{data.revenue.today.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">{data.revenue.todayOrders} orders</p>
            <Link href="/revenue" className="link-primary mt-3 inline-block text-sm">
              Monitor revenue →
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-muted">Revenue (7 days)</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">
              ₱{data.revenue.week.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">{data.revenue.weekOrders} orders</p>
            <Link href="/reports" className="link-primary mt-3 inline-block text-sm">
              Generate reports →
            </Link>
          </CardBody>
        </Card>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Recent incoming activity</h3>
          <Link href="/orders/incoming" className="link-primary text-sm">
            View all →
          </Link>
        </div>
        <div className="space-y-2">
          {data.recentOrders.length === 0 && (
            <p className="text-sm text-muted">No recent activity.</p>
          )}
          {data.recentOrders.map((o) => (
            <Link key={o._id} href={`/orders/${o._id}`} className="list-row">
              <div>
                <p className="font-medium capitalize text-slate-900">{o.bookingType.replace(/_/g, ' ')}</p>
                <p className="text-sm capitalize text-muted">
                  {o.status.replace(/_/g, ' ')}
                  {o.assignedStaffEmail ? ` · ${o.assignedStaffEmail}` : ''}
                </p>
              </div>
              <p className="font-semibold text-slate-900">₱{o.total}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
