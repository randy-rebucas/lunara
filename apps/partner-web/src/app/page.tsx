'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import type { PartnerDashboardData, PartnerOrderSummary } from '@lunara/types';
import { AuthLoading } from '../components/auth-loading';
import { DataPageStatus } from '../components/data-page-status';
import { Card, CardBody, LiveBadge, StatCard } from '../components/ui/card';
import { PageHeader } from '../components/ui/page-header';
import { useRequirePartner } from '../hooks/use-protected-page';
import { formatPeso } from '../lib/format-peso';
import { partnerOrderHref } from '../lib/partner-order-links';
import { getPortalUser, partnerFetch } from '../lib/partner-api';
import { usePartnerQuery } from '../lib/use-partner-query';
import { usePartnerPipelineSocket } from '../lib/use-partner-pipeline-socket';

function orderActionHint(order: PartnerOrderSummary): string | null {
  if (order.canAccept) return 'Awaiting acceptance';
  if (order.canReceiveAtShop) return order.receivingStepLabel ?? 'Shop receiving';
  if (order.receivingStepLabel) return order.receivingStepLabel;
  if (order.currentStepLabel) return order.currentStepLabel;
  return null;
}

export default function PartnerDashboardPage() {
  const { ready } = useRequirePartner();
  const portalUser = getPortalUser();

  const load = useCallback(async () => {
    return partnerFetch<PartnerDashboardData>('/partner/dashboard');
  }, []);

  const { data, loading, error, reload } = usePartnerQuery(load, []);

  const branchIds = useMemo(
    () => (data?.recentOrders ?? []).map((o) => o.branchId).filter(Boolean) as string[],
    [data?.recentOrders],
  );

  const { connected: socketLive } = usePartnerPipelineSocket(branchIds, {
    onPipelineUpdated: () => {
      void reload();
    },
  });

  const alerts = useMemo(() => {
    if (!data) return [];
    const list: { label: string; href: string; tone: 'amber' | 'red' }[] = [];
    if (data.counts.awaitingAccept > 0) {
      list.push({
        label: `${data.counts.awaitingAccept} order${data.counts.awaitingAccept === 1 ? '' : 's'} need acceptance`,
        href: '/orders/incoming',
        tone: 'amber',
      });
    }
    if (data.counts.lowStockItems > 0) {
      list.push({
        label: `${data.counts.lowStockItems} inventory item${data.counts.lowStockItems === 1 ? '' : 's'} low on stock`,
        href: '/inventory',
        tone: 'red',
      });
    }
    if (data.counts.readyForDelivery > 0) {
      list.push({
        label: `${data.counts.readyForDelivery} ready for delivery`,
        href: '/orders/progress',
        tone: 'amber',
      });
    }
    return list;
  }, [data]);

  if (!ready) return <AuthLoading message="Loading dashboard…" />;

  const shopTitle = data?.shop?.name ?? 'Your shop';

  return (
    <div>
      <PageHeader
        title={shopTitle}
        description={
          portalUser?.email
            ? `Welcome back, ${portalUser.email.split('@')[0]}. Orders, staff, and revenue for ${data?.shop?.code ?? 'your branch'}.`
            : 'Shop snapshot — orders, staff, inventory, and revenue at a glance.'
        }
        badge={socketLive ? <LiveBadge /> : undefined}
        actions={
          <button type="button" className="btn-outline btn-sm" onClick={() => reload()}>
            Refresh
          </button>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading dashboard…" />
      </div>

      {data && (
        <>
          {alerts.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {alerts.map((a) => (
                <Link
                  key={a.href + a.label}
                  href={a.href}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    a.tone === 'red'
                      ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                      : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  {a.label} →
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href="/orders/incoming" className="btn-primary btn-sm text-center">
              Incoming orders
            </Link>
            <Link href="/orders" className="btn-outline btn-sm text-center">
              Processing queue
            </Link>
            <Link href="/staff" className="btn-outline btn-sm text-center">
              Staff team
            </Link>
            <Link href="/inventory" className="btn-outline btn-sm text-center">
              Inventory
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              label="Incoming pipeline"
              value={data.counts.incoming}
              href="/orders/incoming"
              warning={data.counts.awaitingAccept > 0}
            />
            <StatCard
              label="In processing"
              value={data.counts.inProcessing}
              href="/orders"
            />
            <StatCard
              label="Ready for delivery"
              value={data.counts.readyForDelivery}
              href="/orders/progress"
              accent="secondary"
            />
            <StatCard
              label="Completed today"
              value={data.counts.completedToday}
              href="/revenue"
              accent="accent"
            />
            <StatCard
              label="Staff members"
              value={data.counts.staffMembers}
              href="/staff"
            />
            <StatCard
              label="Low stock alerts"
              value={data.counts.lowStockItems}
              href="/inventory"
              warning={data.counts.lowStockItems > 0}
            />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card className="!border-accent/25 !bg-accent/5">
              <CardBody>
                <p className="text-sm font-medium text-muted">Revenue today</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-accent">
                  {formatPeso(data.revenue.todayPayout ?? data.revenue.today)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.revenue.todayOrders} completed order
                  {data.revenue.todayOrders === 1 ? '' : 's'}
                </p>
                <Link href="/revenue" className="link-primary mt-3 inline-block text-sm">
                  Revenue details →
                </Link>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm font-medium text-muted">Revenue (7 days)</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">
                  {formatPeso(data.revenue.weekPayout ?? data.revenue.week)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.revenue.weekOrders} completed order
                  {data.revenue.weekOrders === 1 ? '' : 's'}
                </p>
                <Link href="/reports" className="link-primary mt-3 inline-block text-sm">
                  Operational reports →
                </Link>
              </CardBody>
            </Card>
          </div>

          <section className="section-panel mt-10">
            <div className="section-panel-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Recent pipeline activity</h3>
                <p className="mt-0.5 text-sm text-muted">
                  Pickup, intake, and orders moving through your shop
                </p>
              </div>
              <Link href="/orders/incoming" className="link-primary text-sm">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-border/60">
              {data.recentOrders.length === 0 && (
                <p className="px-6 py-8 text-sm text-muted sm:px-8">
                  No active pipeline orders right now. New assignments appear here when Lunara dispatches
                  to your shop.
                </p>
              )}
              {data.recentOrders.map((o) => {
                const hint = orderActionHint(o);
                return (
                  <Link
                    key={o._id}
                    href={partnerOrderHref(o)}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-slate-50/80 sm:px-8"
                  >
                    <div className="min-w-0">
                      <p className="font-medium capitalize text-slate-900">
                        {o.bookingType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm capitalize text-muted">
                        {o.status.replace(/_/g, ' ')}
                        {o.branchName ? ` · ${o.branchName}` : ''}
                      </p>
                      {hint && (
                        <p className="mt-1 text-xs font-medium text-amber-700">{hint}</p>
                      )}
                      {o.slaLabel && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{o.slaLabel}</p>
                      )}
                    </div>
                    <p className="w-full font-semibold text-slate-900 sm:w-auto sm:text-right">{formatPeso(o.total)}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
