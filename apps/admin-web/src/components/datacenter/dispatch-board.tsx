'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../empty-state';
import { LiveBadge } from '../ui/stat-card';
import { MetricCell } from './metric-cell';
import { adminFetch } from '../../lib/admin-api';
import { formatOrderId } from '../../lib/format-label';
import { isAdminRealtimeConnected } from '../../lib/admin-realtime';
import { useAdminQuery } from '../../lib/use-admin-query';
import {
  type DispatcherAlert,
  useAdminOperationsSocket,
} from '../../lib/use-admin-operations-socket';

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
  awaitingPartnerAccept?: boolean;
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

type DispatchState = 'nominal' | 'attention' | 'critical';

const RIDER_STATUS_CLASS: Record<string, string> = {
  Available: 'badge-accent',
  Pickup: 'badge-warning',
  Delivery: 'badge-primary',
  Offline: 'badge-neutral',
};

const QUICK_ACTIONS = [
  { href: '/', label: 'Ops center' },
  { href: '/control-tower', label: 'Control tower' },
  { href: '/orders', label: 'Orders' },
  { href: '/riders', label: 'Riders' },
  { href: '/shops', label: 'Shops' },
] as const;

function deriveDispatchState(
  counts: DispatchDashboard['counts'],
  overCapacityShops: number,
): DispatchState {
  if (overCapacityShops > 0) return 'critical';
  if (
    counts.incoming > 0 ||
    counts.needsShop > 0 ||
    counts.needsPickupRider > 0 ||
    counts.needsDeliveryRider > 0
  ) {
    return 'attention';
  }
  return 'nominal';
}

const dispatchCopy: Record<
  DispatchState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Dispatch nominal',
    detail: 'Queue clear — no pending shop or rider assignments.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Assignments pending',
    detail: 'Orders waiting on shop assignment or rider dispatch.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Capacity pressure',
    detail: 'One or more shops are over weight capacity — rebalance load.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

export function DispatchBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);
  const [shopAssignOrderId, setShopAssignOrderId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<BranchEvaluation[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [liveAlert, setLiveAlert] = useState<DispatcherAlert | null>(null);

  const load = useCallback(async () => {
    const data = await adminFetch<DispatchDashboard>('/admin/dispatch/dashboard');
    setLastUpdated(new Date());
    return data;
  }, []);

  const { data, loading, error, reload } = useAdminQuery(load, []);

  useAdminOperationsSocket({
    onDispatchQueueUpdated: () => {
      void reload();
    },
    onDispatcherAlert: (alert) => {
      if (alert.type !== 'rider_sos') {
        setLiveAlert(alert);
      }
      void reload();
    },
  });

  useEffect(() => {
    setSocketLive(isAdminRealtimeConnected());
    const id = setInterval(() => setSocketLive(isAdminRealtimeConnected()), 2000);
    return () => clearInterval(id);
  }, [data]);

  const counts = data?.counts;
  const overCapacityShops = useMemo(
    () => (data?.shopCapacityBoard ?? []).filter((s) => s.isOverCapacity).length,
    [data?.shopCapacityBoard],
  );
  const availableRiders = useMemo(
    () => (data?.riderBoard ?? []).filter((r) => r.boardStatus === 'Available').length,
    [data?.riderBoard],
  );
  const backlogTotal = counts
    ? counts.needsShop + counts.needsPickupRider + counts.needsDeliveryRider
    : 0;
  const dispatchState = counts ? deriveDispatchState(counts, overCapacityShops) : 'nominal';
  const copy = dispatchCopy[dispatchState];

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  async function openShopAssign(orderId: string) {
    setShopAssignOrderId(orderId);
    setSelectedBranch('');
    setEvaluations([]);
    setAssignError('');
    try {
      const suggestions = await adminFetch<{
        branchEvaluations: BranchEvaluation[];
      }>(`/admin/dispatch/orders/${orderId}/suggestions`);
      setEvaluations(suggestions.branchEvaluations);
      const recommended = suggestions.branchEvaluations.find((b) => b.isRecommended);
      setSelectedBranch(recommended?.branchId ?? '');
    } catch {
      setAssignError('Could not load shop evaluations');
    }
  }

  async function assignShop() {
    if (!shopAssignOrderId || !selectedBranch) return;
    setAssigning(true);
    setAssignError('');
    try {
      await adminFetch(`/admin/dispatch/orders/${shopAssignOrderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ branchId: selectedBranch }),
      });
      setShopAssignOrderId(null);
      await reload();
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'Assign shop failed');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div>
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Logistics</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Dispatch
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              Incoming queue, shop capacity (kg), and rider availability — balance workload across
              branches.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {socketLive ? <LiveBadge /> : <span className="badge-neutral">Polling</span>}
            <span className="dc-sublabel tabular-nums" title="Last data refresh">
              Updated {updatedLabel}
            </span>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-3 py-8 text-sm text-muted">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
            aria-hidden
          />
          Loading dispatch dashboard…
        </div>
      ) : null}

      {data && counts ? (
        <div className="space-y-3">
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${copy.bar}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${copy.dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{copy.label}</p>
              <p className="text-xs text-muted">{copy.detail}</p>
            </div>
            {backlogTotal > 0 ? (
              <span className="dc-sublabel tabular-nums">{backlogTotal} awaiting action</span>
            ) : null}
            {overCapacityShops > 0 ? (
              <span className="badge-danger px-3 py-1 text-xs font-semibold">
                {overCapacityShops} over capacity
              </span>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <MetricCell
              label="Incoming queue"
              value={counts.incoming}
              highlight={counts.incoming > 0 ? 'primary' : undefined}
            />
            <MetricCell
              label="Need shop"
              value={counts.needsShop}
              highlight={counts.needsShop > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Need pickup rider"
              value={counts.needsPickupRider}
              highlight={counts.needsPickupRider > 0 ? 'warning' : undefined}
            />
            <MetricCell
              label="Need delivery rider"
              value={counts.needsDeliveryRider}
              highlight={counts.needsDeliveryRider > 0 ? 'primary' : undefined}
            />
            <MetricCell
              label="Riders available"
              value={availableRiders}
              href="/riders"
              sub={`of ${data.riderBoard.length} on board`}
              highlight={availableRiders === 0 && backlogTotal > 0 ? 'danger' : 'accent'}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-md border border-border/80 bg-surface px-3 py-1.5 dc-chip transition-colors hover:border-primary/40 hover:text-primary"
              >
                {a.label}
              </Link>
            ))}
          </div>

          {liveAlert?.message && liveAlert.type !== 'rider_sos' ? (
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
          ) : null}

          {assignError ? (
            <div className="alert-error" role="alert">
              {assignError}
            </div>
          ) : null}

          <section className="dc-panel">
            <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Incoming orders queue</h2>
                <p className="text-xs text-muted">
                  {counts.incoming} in queue — shop assignment, partner accept, rider dispatch
                </p>
              </div>
              <Link href="/orders" className="link-primary text-xs font-medium">
                Orders ledger →
              </Link>
            </div>

            {data.incomingOrders.length === 0 ? (
              <EmptyState
                title="Queue clear"
                description="No orders waiting on dispatch actions right now."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[800px]">
                  <caption className="sr-only">Incoming dispatch queue</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Area</th>
                      <th scope="col">Weight</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.incomingOrders.map((row) => (
                      <tr key={row.orderId}>
                        <td>
                          <Link
                            href={`/orders/${row.orderId}`}
                            className="link-primary text-code font-semibold"
                          >
                            {row.orderLabel || formatOrderId(row.orderId)}
                          </Link>
                          {row.branchName ? (
                            <p className="mt-0.5 text-xs text-muted">{row.branchName}</p>
                          ) : null}
                        </td>
                        <td className="max-w-[12rem] truncate text-muted" title={row.customer}>
                          {row.customer}
                        </td>
                        <td className="text-muted">{row.area}</td>
                        <td className="tabular-nums">{row.weightKg} kg</td>
                        <td>
                          <span className="badge-neutral capitalize">{row.statusLabel}</span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/orders/${row.orderId}`} className="link-primary text-xs font-medium">
                              Ops →
                            </Link>
                            {row.canAssignShop ? (
                              <button
                                type="button"
                                onClick={() => void openShopAssign(row.orderId)}
                                className="badge-warning px-2 py-1 text-xs font-medium hover:opacity-90"
                              >
                                Assign shop
                              </button>
                            ) : null}
                            {row.awaitingPartnerAccept ? (
                              <span
                                className="badge-neutral px-2 py-1 text-xs font-medium"
                                title="Partner must accept the order in the partner portal before a rider can be assigned"
                              >
                                Awaiting partner
                              </span>
                            ) : null}
                            {row.canAssignPickupRider || row.canAssignDeliveryRider ? (
                              <Link
                                href={`/orders/${row.orderId}`}
                                className="badge-primary px-2 py-1 text-xs font-medium hover:opacity-90"
                              >
                                Assign rider
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {shopAssignOrderId ? (
            <section className="rounded-lg border border-amber-500/35 bg-amber-950/5 px-4 py-4 ring-1 ring-amber-500/20">
              <h3 className="text-sm font-semibold text-slate-900">Assign laundry shop</h3>
              <p className="mt-1 text-xs text-muted">
                Order{' '}
                <span className="text-code">{formatOrderId(shopAssignOrderId)}</span>
              </p>
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
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={assigning || !selectedBranch}
                  onClick={() => void assignShop()}
                  className="btn-primary btn-sm"
                >
                  Confirm assign shop
                </button>
                <button
                  type="button"
                  onClick={() => setShopAssignOrderId(null)}
                  className="btn-outline btn-sm"
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="dc-panel">
              <div className="dc-panel-header">
                <h2 className="text-sm font-semibold text-slate-900">Shop capacity board</h2>
                <p className="text-xs text-muted">Balance workload by weight (kg)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Shop capacity by branch</caption>
                  <thead>
                    <tr>
                      <th scope="col">Shop</th>
                      <th scope="col">Capacity</th>
                      <th scope="col">Current load</th>
                      <th scope="col">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shopCapacityBoard.map((s) => (
                      <tr key={s.branchId} className={s.isOverCapacity ? 'bg-red-50/80' : ''}>
                        <td className="font-medium">
                          {s.shop}
                          <span className="ml-1 text-code text-xs font-normal text-muted">
                            {s.code}
                          </span>
                          {s.isOverCapacity ? (
                            <span className="badge-danger ml-2 text-xs">Over</span>
                          ) : null}
                        </td>
                        <td className="tabular-nums">{s.capacityKg} kg</td>
                        <td className="tabular-nums">{s.currentLoadKg} kg</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full ${s.isOverCapacity ? 'bg-destructive' : 'bg-primary'}`}
                                style={{ width: `${Math.min(100, s.utilizationPercent)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums">{s.utilizationPercent}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="dc-panel">
              <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Rider board</h2>
                  <p className="text-xs text-muted">Live assignment status</p>
                </div>
                <Link href="/riders" className="link-primary text-xs font-medium">
                  All riders →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Rider dispatch board</caption>
                  <thead>
                    <tr>
                      <th scope="col">Rider</th>
                      <th scope="col">Status</th>
                      <th scope="col">Active order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.riderBoard.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-sm text-muted">
                          No riders on the board.
                        </td>
                      </tr>
                    ) : (
                      data.riderBoard.map((r) => (
                        <tr key={r.riderId}>
                          <td>
                            <span className="font-medium">{r.rider}</span>
                            {!r.isOnline ? (
                              <span className="ml-2 text-xs text-muted">offline</span>
                            ) : null}
                          </td>
                          <td>
                            <span
                              className={
                                RIDER_STATUS_CLASS[r.boardStatus] ?? RIDER_STATUS_CLASS.Offline
                              }
                            >
                              {r.boardStatus}
                            </span>
                          </td>
                          <td>
                            {r.activeOrderId ? (
                              <Link
                                href={`/orders/${r.activeOrderId}`}
                                className="link-primary text-code"
                              >
                                {formatOrderId(r.activeOrderId)}
                              </Link>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
