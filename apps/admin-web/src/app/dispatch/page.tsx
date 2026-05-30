'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
  Available: 'bg-emerald-100 text-emerald-800',
  Pickup: 'bg-amber-100 text-amber-800',
  Delivery: 'bg-indigo-100 text-indigo-800',
  Offline: 'bg-slate-100 text-slate-600',
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

  if (loading) return <p className="text-slate-500">Loading dispatch dashboard…</p>;
  if (!data) return <p className="text-red-600">{error || 'No data'}</p>;

  return (
    <div className="space-y-10">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Admin dispatch dashboard</h2>
          {socketLive ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              ● Live
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Incoming queue, shop capacity (kg), and rider availability — balance workload across
          branches.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200">
            {data.counts.incoming} in queue
          </span>
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-900 ring-1 ring-amber-200">
            {data.counts.needsShop} need shop
          </span>
          <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-indigo-900 ring-1 ring-indigo-200">
            {data.counts.needsPickupRider} need pickup rider
          </span>
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-900 ring-1 ring-emerald-200">
            {data.counts.needsDeliveryRider} need delivery rider
          </span>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {liveAlert?.message && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <p>
            <span className="font-medium">Dispatcher alert:</span> {liveAlert.message}
            {liveAlert.orderId ? (
              <>
                {' '}
                <Link href={`/orders/${liveAlert.orderId}`} className="underline">
                  View order
                </Link>
              </>
            ) : null}
          </p>
          <button
            type="button"
            className="text-indigo-700 hover:text-indigo-900"
            onClick={() => setLiveAlert(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold">Incoming orders queue</h3>
          <p className="text-sm text-slate-500">
            Orders needing shop assignment, pickup rider, or delivery rider
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-600">
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
                  <tr key={row.orderId} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs text-slate-500">{row.orderLabel}</span>
                      {row.branchName && (
                        <p className="text-xs text-slate-400">{row.branchName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{row.customer}</td>
                    <td className="px-4 py-3">{row.area}</td>
                    <td className="px-4 py-3">{row.weightKg} kg</td>
                    <td className="px-4 py-3 capitalize">{row.statusLabel}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/orders/${row.orderId}`}
                          className="rounded border px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        >
                          View order
                        </Link>
                        {row.canAssignShop && (
                          <button
                            type="button"
                            onClick={() => openShopAssign(row.orderId)}
                            className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900"
                          >
                            Assign shop
                          </button>
                        )}
                        {(row.canAssignPickupRider || row.canAssignDeliveryRider) && (
                          <Link
                            href={`/orders/${row.orderId}`}
                            className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-900"
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
        <section className="rounded-xl border-2 border-amber-200 bg-amber-50/30 p-6">
          <h3 className="font-semibold text-amber-900">Assign laundry shop</h3>
          <p className="mt-1 text-sm text-slate-600">Order {shopAssignOrderId.slice(-8)}</p>
          <select
            className="mt-4 w-full max-w-md rounded border bg-white px-3 py-2 text-sm"
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirm assign shop
            </button>
            <button
              type="button"
              onClick={() => setShopAssignOrderId(null)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b px-6 py-4">
            <h3 className="text-lg font-semibold">Shop capacity board</h3>
            <p className="text-sm text-slate-500">Balance workload by weight (kg)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600">
                  <th className="px-6 py-3 font-medium">Shop</th>
                  <th className="px-4 py-3 font-medium">Capacity</th>
                  <th className="px-4 py-3 font-medium">Current load</th>
                  <th className="px-4 py-3 font-medium">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {data.shopCapacityBoard.map((s) => (
                  <tr
                    key={s.branchId}
                    className={`border-b last:border-0 ${s.isOverCapacity ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-6 py-3 font-medium">
                      {s.shop}
                      <span className="ml-1 text-xs font-normal text-slate-400">{s.code}</span>
                    </td>
                    <td className="px-4 py-3">{s.capacityKg} kg</td>
                    <td className="px-4 py-3">{s.currentLoadKg} kg</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full ${s.isOverCapacity ? 'bg-red-500' : 'bg-indigo-500'}`}
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

        <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b px-6 py-4">
            <h3 className="text-lg font-semibold">Rider board</h3>
            <p className="text-sm text-slate-500">Live assignment status</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600">
                  <th className="px-6 py-3 font-medium">Rider</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Active order</th>
                </tr>
              </thead>
              <tbody>
                {data.riderBoard.map((r) => (
                  <tr key={r.riderId} className="border-b last:border-0">
                    <td className="px-6 py-3">
                      <span className="font-medium">{r.rider}</span>
                      {!r.isOnline && (
                        <span className="ml-2 text-xs text-slate-400">offline</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          RIDER_STATUS_CLASS[r.boardStatus] ?? RIDER_STATUS_CLASS.Offline
                        }`}
                      >
                        {r.boardStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.activeOrderId ? (
                        <Link
                          href={`/orders/${r.activeOrderId}`}
                          className="font-mono text-xs text-indigo-600 hover:underline"
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
