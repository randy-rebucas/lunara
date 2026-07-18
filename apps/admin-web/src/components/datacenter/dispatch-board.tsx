'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../empty-state';
import { LiveBadge } from '../ui/stat-card';
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
  code: string;
  name: string;
  distanceLabel: string;
  recommendationScore: number;
  rank: number;
  isRecommended: boolean;
  qualified: boolean;
  estimatedTurnaroundLabel: string;
  capacity: { utilizationPercent: number; label: string };
  performance: { score: number; label: string; onTimeRatePercent: number };
  availability: { acceptingOrders: boolean; label: string };
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

function queueStatusTone(status: string): string {
  if (status === 'pending' || status === 'pending_dispatch') return 'badge-warning';
  if (status.includes('rider') || status.includes('delivery')) return 'badge-primary';
  return 'badge-secondary';
}

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

// ── Small blocks ───────────────────────────────────────────────────────────
const TILE_TONES = {
  primary: 'bg-primary/[0.04] ring-primary/15',
  secondary: 'bg-secondary/[0.04] ring-secondary/15',
  accent: 'bg-accent/[0.04] ring-accent/20',
  amber: 'bg-amber-500/[0.04] ring-amber-500/20',
  violet: 'bg-violet-500/[0.04] ring-violet-500/20',
  rose: 'bg-rose-500/[0.04] ring-rose-500/20',
} as const;

function StatTile({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof TILE_TONES;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="dc-value mt-1">{value}</p>
      {sub ? <p className="dc-sublabel mt-0.5">{sub}</p> : null}
    </>
  );
  const cls = `block rounded-xl p-4 ring-1 ${TILE_TONES[tone]}`;
  return href ? (
    <Link href={href} className={`${cls} transition-all hover:shadow-[var(--shadow-elevated)]`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function PanelHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dc-panel-header flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {sub ? <p className="text-xs text-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

function CapacityBar({ percent, over }: { percent: number; over: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${over ? 'bg-destructive' : percent >= 80 ? 'bg-amber-500' : 'bg-primary/80'}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────
export function DispatchBoard() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [socketLive, setSocketLive] = useState(false);
  const [shopAssignOrderId, setShopAssignOrderId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<BranchEvaluation[]>([]);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
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
    setLoadingEvaluations(true);
    try {
      const suggestions = await adminFetch<{
        branchEvaluations: BranchEvaluation[];
      }>(`/admin/dispatch/orders/${orderId}/suggestions`);
      setEvaluations(suggestions.branchEvaluations);
      const recommended = suggestions.branchEvaluations.find((b) => b.isRecommended);
      setSelectedBranch(recommended?.branchId ?? '');
    } catch {
      setAssignError('Could not load shop evaluations');
    } finally {
      setLoadingEvaluations(false);
    }
  }

  function closeShopAssign() {
    setShopAssignOrderId(null);
    setEvaluations([]);
    setSelectedBranch('');
    setAssignError('');
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
      closeShopAssign();
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
              Incoming queue, shop capacity, and rider availability — balance workload across the
              network.
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
            <Link href="/live-tracking" className="btn-outline btn-sm">
              Live tracking
            </Link>
            <Link href="/control-tower" className="btn-primary btn-sm">
              Control tower
            </Link>
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
        <div className="space-y-4">
          {/* State banner */}
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

          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatTile
              label="Incoming queue"
              value={String(counts.incoming)}
              sub="orders needing action"
              tone="primary"
            />
            <StatTile label="Need shop" value={String(counts.needsShop)} sub="awaiting assignment" tone="amber" />
            <StatTile
              label="Need pickup rider"
              value={String(counts.needsPickupRider)}
              sub="shop accepted"
              tone="secondary"
            />
            <StatTile
              label="Need delivery rider"
              value={String(counts.needsDeliveryRider)}
              sub="ready lane"
              tone="violet"
            />
            <StatTile
              label="Riders available"
              value={String(availableRiders)}
              sub={`of ${data.riderBoard.length} on board`}
              tone={availableRiders === 0 && backlogTotal > 0 ? 'rose' : 'accent'}
              href="/riders"
            />
          </div>

          {/* Live dispatcher alert */}
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

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            {/* ── Incoming queue ── */}
            <section className="dc-panel min-w-0 xl:col-span-8">
              <PanelHeader
                title="Incoming orders queue"
                sub={`${counts.incoming} in queue — shop assignment, partner accept, rider dispatch`}
                action={
                  <Link href="/orders" className="link-primary text-xs font-medium">
                    Orders ledger →
                  </Link>
                }
              />

              {data.incomingOrders.length === 0 ? (
                <EmptyState
                  title="Queue clear"
                  description="No orders waiting on dispatch actions right now."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[720px]">
                    <caption className="sr-only">Incoming dispatch queue</caption>
                    <thead>
                      <tr>
                        <th scope="col">Order</th>
                        <th scope="col">Customer</th>
                        <th scope="col">Area</th>
                        <th scope="col">Load</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.incomingOrders.map((row) => {
                        const isAssigning = shopAssignOrderId === row.orderId;
                        return (
                          <tr key={row.orderId} className={isAssigning ? 'bg-primary/5 hover:bg-primary/5' : ''}>
                            <td>
                              <Link
                                href={`/orders/${row.orderId}`}
                                className="link-primary text-code font-semibold"
                              >
                                {row.orderLabel || formatOrderId(row.orderId)}
                              </Link>
                              {row.branchName ? (
                                <p className="mt-0.5 max-w-[10rem] truncate text-xs text-muted" title={row.branchName}>
                                  {row.branchName}
                                </p>
                              ) : null}
                            </td>
                            <td className="max-w-[11rem] truncate text-muted" title={row.customer}>
                              {row.customer}
                            </td>
                            <td className="max-w-[8rem] truncate text-muted" title={row.area}>
                              {row.area}
                            </td>
                            <td className="whitespace-nowrap tabular-nums">{row.weightKg} kg</td>
                            <td>
                              <span className={`${queueStatusTone(row.status)} whitespace-nowrap capitalize`}>
                                {row.statusLabel}
                              </span>
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-1.5">
                                {row.canAssignShop ? (
                                  <button
                                    type="button"
                                    onClick={() => void openShopAssign(row.orderId)}
                                    className="btn-primary btn-sm"
                                    disabled={isAssigning}
                                  >
                                    {isAssigning ? 'Assigning…' : 'Assign shop'}
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
                                  <Link href={`/orders/${row.orderId}`} className="btn-outline btn-sm">
                                    Assign rider
                                  </Link>
                                ) : null}
                                {!row.canAssignShop &&
                                !row.awaitingPartnerAccept &&
                                !row.canAssignPickupRider &&
                                !row.canAssignDeliveryRider ? (
                                  <Link href={`/orders/${row.orderId}`} className="link-primary text-xs font-medium">
                                    Ops →
                                  </Link>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Rail ── */}
            <div className="space-y-4 xl:col-span-4">
              {shopAssignOrderId ? (
                <section className="dc-panel ring-2 ring-primary/30">
                  <PanelHeader
                    title="Assign laundry shop"
                    sub={`Order ${formatOrderId(shopAssignOrderId)} — ranked by distance, capacity, and performance`}
                    action={
                      <button type="button" className="btn-ghost btn-sm" aria-label="Cancel assignment" onClick={closeShopAssign}>
                        ✕
                      </button>
                    }
                  />
                  {assignError ? (
                    <p className="px-4 pt-3 text-sm text-destructive" role="alert">
                      {assignError}
                    </p>
                  ) : null}
                  {loadingEvaluations ? (
                    <p className="px-4 py-6 text-sm text-muted">Evaluating branches…</p>
                  ) : (
                    <div className="max-h-[24rem] space-y-2 overflow-y-auto p-3">
                      {evaluations.map((b) => {
                        const selected = selectedBranch === b.branchId;
                        return (
                          <button
                            key={b.branchId}
                            type="button"
                            onClick={() => setSelectedBranch(b.branchId)}
                            aria-pressed={selected}
                            className={`w-full rounded-lg p-3 text-left ring-1 transition-all ${
                              selected
                                ? 'bg-primary/5 ring-2 ring-primary/40'
                                : 'ring-border/60 hover:ring-primary/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {b.name}
                                  <span className="text-code ml-1.5 text-xs font-normal text-muted">{b.code}</span>
                                </p>
                                <p className="mt-0.5 text-xs text-muted">
                                  {b.distanceLabel} · {b.estimatedTurnaroundLabel}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <span className="text-sm font-bold tabular-nums text-slate-900">
                                  {b.recommendationScore}
                                </span>
                                {b.isRecommended ? <span className="badge-accent">Recommended</span> : null}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <CapacityBar
                                percent={b.capacity.utilizationPercent}
                                over={b.capacity.utilizationPercent >= 100}
                              />
                              <span className="shrink-0 text-xs tabular-nums text-muted">
                                {b.capacity.utilizationPercent}%
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="badge-neutral">{b.performance.label}</span>
                              {!b.availability.acceptingOrders ? (
                                <span className="badge-danger">{b.availability.label}</span>
                              ) : null}
                              {!b.qualified ? (
                                <span
                                  className="badge-warning"
                                  title="Below the auto-dispatch quality bar — manual assignment still allowed"
                                >
                                  Below quality bar
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                      {evaluations.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted">No branches evaluated.</p>
                      ) : null}
                    </div>
                  )}
                  <div className="flex gap-2 border-t border-border/60 px-3 py-3">
                    <button
                      type="button"
                      disabled={assigning || !selectedBranch}
                      onClick={() => void assignShop()}
                      className="btn-primary btn-sm flex-1"
                    >
                      {assigning ? 'Assigning…' : 'Confirm assignment'}
                    </button>
                    <button type="button" onClick={closeShopAssign} className="btn-outline btn-sm">
                      Cancel
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="dc-panel">
                <PanelHeader title="Shop capacity" sub="Workload by weight (kg)" />
                {data.shopCapacityBoard.length === 0 ? (
                  <p className="dc-panel-empty text-sm text-muted">No operational shops yet.</p>
                ) : (
                  <ul className="space-y-3 px-4 py-4">
                    {data.shopCapacityBoard.map((s) => (
                      <li key={s.branchId}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium text-slate-900" title={s.shop}>
                            {s.shop}
                            <span className="text-code ml-1.5 text-xs font-normal text-muted">{s.code}</span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted">
                            {s.currentLoadKg} / {s.capacityKg} kg
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <CapacityBar percent={s.utilizationPercent} over={s.isOverCapacity} />
                          <span
                            className={`shrink-0 text-xs font-semibold tabular-nums ${
                              s.isOverCapacity ? 'text-red-600' : 'text-slate-700'
                            }`}
                          >
                            {s.utilizationPercent}%
                          </span>
                        </div>
                        {s.isOverCapacity ? (
                          <span className="badge-danger mt-1">Over capacity</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dc-panel">
                <PanelHeader
                  title="Rider board"
                  sub="Live assignment status"
                  action={
                    <Link href="/riders" className="link-primary text-xs font-medium">
                      All riders →
                    </Link>
                  }
                />
                {data.riderBoard.length === 0 ? (
                  <p className="dc-panel-empty text-sm text-muted">No riders on the board.</p>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {data.riderBoard.map((r) => (
                      <li key={r.riderId} className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${r.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{r.rider}</p>
                          {r.activeOrderId ? (
                            <Link href={`/orders/${r.activeOrderId}`} className="link-primary text-code text-xs">
                              {formatOrderId(r.activeOrderId)}
                            </Link>
                          ) : (
                            <p className="text-xs text-muted">No active order</p>
                          )}
                        </div>
                        <span className={RIDER_STATUS_CLASS[r.boardStatus] ?? RIDER_STATUS_CLASS.Offline}>
                          {r.boardStatus}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
