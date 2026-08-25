'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import type { PartnerDashboardData, PartnerOrderSummary } from '@lunara/types';
import { AuthLoading } from '../components/auth-loading';
import { DataPageStatus } from '../components/data-page-status';
import { LiveBadge, StatCard, StatusPill } from '../components/ui/card';
import { PageHeader } from '../components/ui/page-header';
import { Icon, ICONS } from '../components/ui/icon';
import { DonutChart, DonutLegend, RevenueLineChart, withDonutColors } from '../components/dash-charts';
import { useRequirePartner } from '../hooks/use-protected-page';
import { formatPeso } from '../lib/format-peso';
import { partnerOrderHref } from '../lib/partner-order-links';
import { getPortalUser, partnerFetch } from '../lib/partner-api';
import { usePartnerQuery } from '../lib/use-partner-query';
import { usePartnerPipelineSocket } from '../lib/use-partner-pipeline-socket';

const QUICK_ACTIONS = [
  { href: '/orders/incoming', label: 'Incoming orders', icon: ICONS.receipt },
  { href: '/orders', label: 'Processing queue', icon: ICONS.list },
  { href: '/staff', label: 'Staff team', icon: ICONS.users },
  { href: '/inventory', label: 'Inventory', icon: ICONS.shelf },
] as const;

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

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="quick-action-tile">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon d={a.icon} />
                </span>
                <span className="text-sm font-medium text-slate-700">{a.label}</span>
              </Link>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Today's orders"
              value={data.trends.ordersToday.value}
              href="/orders/incoming"
              trend={{ deltaPct: data.trends.ordersToday.deltaPct }}
            />
            <StatCard
              label="Completed orders"
              value={data.trends.completedToday.value}
              href="/orders/history"
              accent="accent"
              trend={{ deltaPct: data.trends.completedToday.deltaPct }}
            />
            <StatCard
              label="Revenue"
              value={formatPeso(data.trends.revenueToday.value, true)}
              href="/revenue"
              accent="secondary"
              trend={{ deltaPct: data.trends.revenueToday.deltaPct }}
            />
            <StatCard
              label="Staff members"
              value={data.trends.staffMembers.value}
              href="/staff"
              trend={{ deltaPct: data.trends.staffMembers.deltaPct }}
            />
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <section className="section-panel lg:col-span-2">
              <div className="section-panel-header flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Recent orders</h3>
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
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusPill status={o.status} />
                          {o.branchName && <span className="text-sm text-muted">{o.branchName}</span>}
                        </div>
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

            <div className="flex flex-col gap-4">
              <section className="section-panel">
                <div className="section-panel-header flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Revenue overview</h3>
                    <p className="mt-0.5 text-xs text-muted">Last 7 days</p>
                  </div>
                  <Link href="/revenue" className="link-primary text-xs">
                    Details →
                  </Link>
                </div>
                <div className="card-body pt-4">
                  <RevenueLineChart data={data.revenue.series} />
                </div>
              </section>

              <section className="section-panel">
                <div className="section-panel-header">
                  <h3 className="text-base font-semibold text-slate-900">Top services</h3>
                  <p className="mt-0.5 text-xs text-muted">Last 7 days, by order count</p>
                </div>
                <div className="card-body pt-4">
                  {data.services.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">No completed orders this week yet.</p>
                  ) : (
                    <>
                      <DonutChart
                        segments={withDonutColors(data.services)}
                        centerLabel="Orders"
                        centerValue={String(data.services.reduce((s, x) => s + x.count, 0))}
                      />
                      <div className="mt-4">
                        <DonutLegend segments={withDonutColors(data.services)} />
                      </div>
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
