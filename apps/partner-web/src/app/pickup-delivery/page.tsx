'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PartnerBranchRider, PartnerOrderSummary, PartnerOwnedRider } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { LiveBadge } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { formatPeso } from '../../lib/format-peso';
import { isPartnerRole, listAssignedRiders, listOwnedRiders, partnerFetch } from '../../lib/partner-api';
import { partnerOrderHref } from '../../lib/partner-order-links';
import { usePartnerQuery } from '../../lib/use-partner-query';
import { usePartnerPipelineSocket } from '../../lib/use-partner-pipeline-socket';

function riderName(r: { firstName?: string; lastName?: string; email?: string }) {
  const name = [r.firstName, r.lastName].filter(Boolean).join(' ');
  return name || r.email || 'Rider';
}

export default function PickupDeliveryPage() {
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.ADMIN, UserRole.STAFF] });
  const partner = isPartnerRole();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const loadOrders = useCallback(async () => {
    const d = await partnerFetch<{ items: PartnerOrderSummary[] }>('/partner/orders/incoming');
    return d.items;
  }, []);
  const { data: orders, loading: ordersLoading, error: ordersError, reload: reloadOrders } = usePartnerQuery(
    loadOrders,
    [],
  );

  const loadAssignedRiders = useCallback(() => listAssignedRiders(), []);
  const { data: assignedRiders, loading: assignedLoading, error: assignedError } = usePartnerQuery(
    loadAssignedRiders,
    [],
  );

  const loadOwnedRiders = useCallback(() => (partner ? listOwnedRiders() : Promise.resolve([])), [partner]);
  const { data: ownedRiders, loading: ownedLoading, error: ownedError } = usePartnerQuery(loadOwnedRiders, [partner]);

  const branchIds = useMemo(
    () => [...new Set((orders ?? []).map((o) => o.branchId).filter(Boolean))] as string[],
    [orders],
  );
  const { connected: socketLive } = usePartnerPipelineSocket(branchIds, {
    onPipelineUpdated: () => {
      reloadOrders();
    },
  });

  async function runAction(orderId: string, path: string) {
    setBusy(orderId + path);
    setActionError('');
    try {
      await partnerFetch(path, { method: 'POST' });
      await reloadOrders();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  const loading = ordersLoading || assignedLoading || ownedLoading;
  const error = ordersError || assignedError || ownedError;

  if (!ready) return <AuthLoading message="Loading pickup & delivery…" />;

  const needsPickup = (orders ?? []).filter((o) => o.canRequestPickup);
  const needsDelivery = (orders ?? []).filter((o) => o.canRequestDelivery);

  const activeRiders = [
    ...((assignedRiders ?? []) as PartnerBranchRider[])
      .filter((b) => b.rider)
      .map((b) => ({
        key: `assigned-${b.branchId}`,
        name: riderName(b.rider!),
        vehicleType: b.rider!.vehicleType,
        isOnline: b.rider!.isOnline,
        shiftStatus: b.rider!.shiftStatus,
        context: `Default rider · ${b.branchName}`,
      })),
    ...((ownedRiders ?? []) as PartnerOwnedRider[]).map((r) => ({
      key: `owned-${r._id}`,
      name: riderName(r),
      vehicleType: r.vehicleType,
      isOnline: r.isOnline,
      shiftStatus: r.shiftStatus,
      context: 'Your rider',
    })),
  ];

  function OrderRow({ order, actionLabel, actionPath, canAct }: { order: PartnerOrderSummary; actionLabel: string; actionPath: string; canAct: boolean }) {
    return (
      <tr key={order._id}>
        <td className="font-medium text-slate-900">
          <a href={partnerOrderHref(order)} className="hover:underline">
            #{order._id.slice(-6).toUpperCase()}
          </a>
        </td>
        <td className="text-muted">{order.branchName ?? '—'}</td>
        <td className="text-muted">{order.currentStepLabel ?? order.status}</td>
        <td className="text-muted">{formatPeso(order.total, true)}</td>
        <td>
          {canAct ? (
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={busy === order._id + actionPath}
              onClick={() => void runAction(order._id, actionPath)}
            >
              {busy === order._id + actionPath ? 'Requesting…' : actionLabel}
            </button>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pickup & Delivery"
        description="A dedicated view for scheduling and tracking rider pickups and deliveries."
        badge={socketLive ? <LiveBadge /> : undefined}
        actions={
          <button type="button" className="btn-outline btn-sm" onClick={() => reloadOrders()}>
            Refresh
          </button>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading…" onRetry={reloadOrders} />
      </div>

      {actionError && (
        <div className="alert-error mt-3 flex flex-wrap items-center justify-between gap-3">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError('')}
            className="shrink-0 text-sm font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="section-panel mt-4 overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Riders</h2>
            </div>
            {activeRiders.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">No riders assigned yet.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeRiders.map((r) => (
                  <div key={r.key} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      <span className={r.isOnline ? 'badge-accent text-xs' : 'badge-neutral text-xs'}>
                        {r.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{r.context}</p>
                    <p className="mt-1 text-xs text-muted">
                      {r.vehicleType ?? 'Vehicle n/a'}
                      {r.shiftStatus ? ` · ${r.shiftStatus}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-panel mt-6 overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Needs pickup ({needsPickup.length})</h2>
            </div>
            {needsPickup.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">No orders waiting for pickup.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Branch</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {needsPickup.map((o) => (
                      <OrderRow
                        key={o._id}
                        order={o}
                        actionLabel="Request pickup"
                        actionPath={`/partner/orders/${o._id}/request-pickup`}
                        canAct
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="section-panel mt-6 overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Needs delivery ({needsDelivery.length})</h2>
            </div>
            {needsDelivery.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">No orders waiting for delivery.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Branch</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {needsDelivery.map((o) => (
                      <OrderRow
                        key={o._id}
                        order={o}
                        actionLabel="Request delivery"
                        actionPath={`/partner/orders/${o._id}/request-delivery`}
                        canAct
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
