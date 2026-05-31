'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/page-header';
import { LiveBadge } from '../../components/ui/stat-card';
import { adminFetch } from '../../lib/admin-api';
import {
  type DispatcherAlert,
  useAdminOperationsSocket,
} from '../../lib/use-admin-tracking-socket';

interface IncomingOrder {
  orderId: string;
  orderLabel: string;
  customer: string;
  area: string;
  weightKg: number;
  status: string;
  statusLabel: string;
  branchName?: string;
  canAssignShop: boolean;
  canAssignPickupRider: boolean;
  canAssignDeliveryRider: boolean;
}

interface ShopCapacity {
  branchId: string;
  shop: string;
  code: string;
  capacityKg: number;
  currentLoadKg: number;
  utilizationPercent: number;
  headroomKg: number;
  isOverCapacity: boolean;
}

interface RiderBoardRow {
  riderId: string;
  userId: string;
  rider: string;
  boardStatus: 'Available' | 'Pickup' | 'Delivery' | 'Offline';
  isOnline: boolean;
  activeOrderId?: string;
}

interface BranchEvaluation {
  branchId: string;
  name: string;
  recommendationScore: number;
  isRecommended: boolean;
  availability: { acceptingOrders: boolean };
}

interface DispatchDashboard {
  incomingOrders: IncomingOrder[];
  shopCapacityBoard: ShopCapacity[];
  riderBoard: RiderBoardRow[];
  counts: {
    incoming: number;
    needsShop: number;
    needsPickupRider: number;
    needsDeliveryRider: number;
  };
}

const RIDER_STATUS_CLASS: Record<string, string> = {
  Available: 'badge-accent',
  Pickup: 'badge-warning',
  Delivery: 'badge-primary',
  Offline: 'badge-neutral',
};

export default function AdminDispatchDashboardPage() {
  const [data, setData] = useState<DispatchDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shopAssignOrderId, setShopAssignOrderId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<BranchEvaluation[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [liveAlert, setLiveAlert] = useState<DispatcherAlert | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch<DispatchDashboard>('/admin/dispatch/dashboard');
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dispatch dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSilent = useCallback(async () => {
    try {
      const res = await adminFetch<DispatchDashboard>('/admin/dispatch/dashboard');
      setData(res);
    } catch {
      // keep existing dashboard on background refresh failure
    }
  }, []);

  const { connected: socketLive } = useAdminOperationsSocket({
    onDispatchQueueUpdated: () => {
      void loadSilent();
    },
    onDispatcherAlert: (alert) => {
      setLiveAlert(alert);
      void loadSilent();
    },
  });

  useEffect(() => {
    load();
  }, [load]);

  async function openShopAssign(orderId: string) {
    setShopAssignOrderId(orderId);
    setSelectedBranch('');
    setEvaluations([]);
    try {
      const q = await adminFetch<{ items: { _id: string; branchEvaluations: BranchEvaluation[]; recommendedBranchId?: string }[] }>(
        '/admin/dispatch/queue',
      );
      const item = q.items.find((i) => i._id === orderId);
      if (item) {
        setEvaluations(item.branchEvaluations);
        setSelectedBranch(item.recommendedBranchId ?? '');
      }
    } catch {
      setError('Could not load shop evaluations');
    }
  }

  async function assignShop() {
    if (!shopAssignOrderId || !selectedBranch) return;
    setAssigning(true);
    try {
      await adminFetch(`/admin/dispatch/orders/${shopAssignOrderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ branchId: selectedBranch }),
      });
      setShopAssignOrderId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assign shop failed');
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Dispatch" description="Incoming queue, shop capacity, and rider availability." />
        <p className="text-sm text-muted">Loading dispatch dashboard…</p>
      </div>
    );
  }
  if (!data) return <div className="alert-error">{error || 'No data'}</div>;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Dispatch"
        description="Incoming queue, shop capacity (kg), and rider availability — balance workload across branches."
        badge={socketLive ? <LiveBadge /> : undefined}
        actions={
          <button type="button" onClick={load} className="btn-outline btn-sm">
            Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="filter-chip">{data.counts.incoming} in queue</span>
        <span className="badge-warning px-3 py-1.5">{data.counts.needsShop} need shop</span>
        <span className="badge-primary px-3 py-1.5">{data.counts.needsPickupRider} need pickup rider</span>
        <span className="badge-accent px-3 py-1.5">{data.counts.needsDeliveryRider} need delivery rider</span>
      </div>

      {liveAlert?.message && (
        <div className="alert-info flex flex-wrap items-start justify-between gap-3">
          <p>
            <span className="font-medium">Dispatcher alert:</span> {liveAlert.message}
            {liveAlert.orderId ? (
              <>
                {' '}
                <Link href={`/orders/${liveAlert.orderId}`} className="link-primary underline">
                  View order
                </Link>
              </>
            ) : null}
          </p>
          <button type="button" className="link-primary" onClick={() => setLiveAlert(null)}>
            Dismiss
          </button>
        </div>
      )}

      {error && <div className="alert-error">{error}</div>}

      <section className="section-panel">
        <div className="section-panel-header">
          <h3 className="text-lg font-semibold text-slate-900">Incoming orders queue</h3>
          <p className="text-sm text-muted">
            Orders needing shop assignment, pickup rider, or delivery rider
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[800px]">
            <thead>
              <tr>
                <th className="px-6 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Weight</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.incomingOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-slate-500">
                    No orders in the dispatch queue.
                  </td>
                </tr>
              ) : (
                data.incomingOrders.map((row) => (
                  <tr key={row.orderId}>
                    <td className="!pl-6">
                      <span className="font-mono text-xs text-slate-500">{row.orderLabel}</span>
                      {row.branchName && (
                        <p className="text-xs text-slate-400">{row.branchName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{row.customer}</td>
                    <td className="px-4 py-3">{row.area}</td>
                    <td className="px-4 py-3">{row.weightKg} kg</td>
                    <td className="px-4 py-3 capitalize">{row.statusLabel}</td>
                    <td className="!pr-6">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/orders/${row.orderId}`} className="btn-outline btn-sm">
                          View order
                        </Link>
                        {row.canAssignShop && (
                          <button
                            type="button"
                            onClick={() => openShopAssign(row.orderId)}
                            className="badge-warning px-2 py-1 text-xs font-medium hover:opacity-90"
                          >
                            Assign shop
                          </button>
                        )}
                        {(row.canAssignPickupRider || row.canAssignDeliveryRider) && (
                          <Link
                            href={`/orders/${row.orderId}`}
                            className="badge-primary px-2 py-1 text-xs font-medium hover:opacity-90"
                          >
                            Assign rider
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {shopAssignOrderId && (
        <section className="rounded-xl border-2 border-amber-200/80 bg-amber-50/40 p-6 ring-1 ring-amber-100">
          <h3 className="font-semibold text-amber-900">Assign laundry shop</h3>
          <p className="mt-1 text-sm text-muted">Order {shopAssignOrderId.slice(-8)}</p>
          <select
            className="input-field mt-4 max-w-md"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="">Select shop…</option>
            {evaluations.map((b) => (
              <option
                key={b.branchId}
                value={b.branchId}
                disabled={!b.availability.acceptingOrders}
              >
                {b.name} — score {b.recommendationScore}
                {b.isRecommended ? ' ★' : ''}
              </option>
            ))}
          </select>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={assigning || !selectedBranch}
              onClick={assignShop}
              className="btn-primary"
            >
              Confirm assign shop
            </button>
            <button type="button" onClick={() => setShopAssignOrderId(null)} className="btn-outline">
              Cancel
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="section-panel">
          <div className="section-panel-header">
            <h3 className="text-lg font-semibold text-slate-900">Shop capacity board</h3>
            <p className="text-sm text-muted">Balance workload by weight (kg)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-3 font-medium">Shop</th>
                  <th className="px-4 py-3 font-medium">Capacity</th>
                  <th className="px-4 py-3 font-medium">Current load</th>
                  <th className="px-4 py-3 font-medium">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {data.shopCapacityBoard.map((s) => (
                  <tr key={s.branchId} className={s.isOverCapacity ? 'bg-red-50/80' : ''}>
                    <td className="!pl-6 font-medium">
                      {s.shop}
                      <span className="ml-1 text-xs font-normal text-slate-400">{s.code}</span>
                    </td>
                    <td className="px-4 py-3">{s.capacityKg} kg</td>
                    <td className="px-4 py-3">{s.currentLoadKg} kg</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full ${s.isOverCapacity ? 'bg-destructive' : 'bg-primary'}`}
                            style={{ width: `${Math.min(100, s.utilizationPercent)}%` }}
                          />
                        </div>
                        <span className="text-xs">{s.utilizationPercent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-panel">
          <div className="section-panel-header">
            <h3 className="text-lg font-semibold text-slate-900">Rider board</h3>
            <p className="text-sm text-muted">Live assignment status</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-6 py-3 font-medium">Rider</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Active order</th>
                </tr>
              </thead>
              <tbody>
                {data.riderBoard.map((r) => (
                  <tr key={r.riderId}>
                    <td className="!pl-6">
                      <span className="font-medium">{r.rider}</span>
                      {!r.isOnline && (
                        <span className="ml-2 text-xs text-slate-400">offline</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={RIDER_STATUS_CLASS[r.boardStatus] ?? RIDER_STATUS_CLASS.Offline}>
                        {r.boardStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.activeOrderId ? (
                        <Link
                          href={`/orders/${r.activeOrderId}`}
                          className="link-primary font-mono text-xs"
                        >
                          {r.activeOrderId.slice(-8)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
