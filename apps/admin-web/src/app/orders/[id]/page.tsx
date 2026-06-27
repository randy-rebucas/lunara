'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../../components/data-page-status';
import { MetricCell } from '../../../components/datacenter/metric-cell';
import { DetailRow, OpsPanel } from '../../../components/ui/ops-panel';
import { adminFetch } from '../../../lib/admin-api';
import { formatOrderId, formatSlugLabel } from '../../../lib/format-label';
import { useAdminQuery } from '../../../lib/use-admin-query';
import { useAdminOperationsSocket } from '../../../lib/use-admin-operations-socket';

interface OpsOrder {
  _id: string;
  status: string;
  bookingType: string;
  branchName?: string;
  dispatchStatus?: string;
  partnerAcceptedAt?: string;
  pickupRequestedAt?: string;
  pickupRiderId?: string;
  deliveryRiderId?: string;
  deliveryRequestedAt?: string;
  operationsConflict?: boolean;
  operationsConflictNote?: string;
  fulfillmentType?: 'delivery' | 'customer_pickup';
  customerPickupAt?: string;
  total?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentReceiptCode?: string;
  cashTiming?: 'pickup' | 'delivery';
  paymentPaidAt?: string;
  cashCollectedBy?: string;
  sla: { status: string; label: string };
}

interface RiderSuggestion {
  userId: string;
  email?: string;
  isOnline: boolean;
  distanceLabel: string;
  recommendationScore: number;
  rank: number;
  isRecommended: boolean;
  availabilityLabel: string;
}

interface OpsData {
  order: OpsOrder;
  customer: { email?: string; phone?: string } | null;
  suggestedPickupRiderId?: string | null;
  suggestedDeliveryRiderId?: string | null;
  pickupRiderSuggestions?: {
    suggestions: RiderSuggestion[];
    suggestedRiderId: string | null;
  } | null;
  deliveryRiderSuggestions?: {
    suggestions: RiderSuggestion[];
    suggestedRiderId: string | null;
  } | null;
  availableRiders: { userId: string; email?: string; isOnline: boolean }[];
}

type OrderOpsState = 'nominal' | 'attention' | 'critical';

function deriveOrderOpsState(
  o: OpsOrder,
  flags: { awaitingPartnerAccept: boolean; canAssignPickup: boolean; canAssignDelivery: boolean },
): OrderOpsState {
  if (o.operationsConflict || o.sla.status === 'breached') return 'critical';
  if (
    o.status === 'pending_dispatch' ||
    flags.awaitingPartnerAccept ||
    flags.canAssignPickup ||
    flags.canAssignDelivery ||
    o.sla.status === 'warning'
  ) {
    return 'attention';
  }
  return 'nominal';
}

const orderOpsCopy: Record<
  OrderOpsState,
  { label: string; detail: string; dot: string; bar: string }
> = {
  nominal: {
    label: 'Order on track',
    detail: 'No conflicts, SLA within bounds, no pending dispatch actions.',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    bar: 'border-emerald-500/30 bg-emerald-950/5',
  },
  attention: {
    label: 'Action required',
    detail: 'Dispatch, partner accept, or rider assignment may be needed.',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    bar: 'border-amber-500/35 bg-amber-950/5',
  },
  critical: {
    label: 'Critical exception',
    detail: 'SLA breach or operational conflict — review and resolve.',
    dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    bar: 'border-red-500/35 bg-red-950/5',
  },
};

const QUICK_ACTIONS = [
  { href: '/orders', label: 'Orders' },
  { href: '/dispatch', label: 'Dispatch' },
  { href: '/control-tower', label: 'Control tower' },
  { href: '/support', label: 'Support' },
] as const;

export default function AdminOrderOpsPage() {
  const { id } = useParams<{ id: string }>();
  const [riderId, setRiderId] = useState('');
  const [assignType, setAssignType] = useState<'pickup' | 'delivery'>('pickup');
  const [conflictNote, setConflictNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) throw new Error('Order not found');
    return adminFetch<OpsData>(`/admin/operations/orders/${id}`);
  }, [id]);

  const { data, loading, error: loadError, reload } = useAdminQuery(load, [id]);

  useAdminOperationsSocket({
    onDispatchQueueUpdated: () => {
      void reload();
    },
    onDispatcherAlert: (alert) => {
      if (alert.orderId === id) void reload();
    },
  });

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading || loadError || !data) {
    return (
      <div>
        <Link
          href="/orders"
          className="mb-3 inline-flex items-center text-sm text-muted transition-colors hover:text-primary"
        >
          ← Orders
        </Link>
        <DataPageStatus loading={loading} error={loadError} loadingMessage="Loading order…" />
      </div>
    );
  }

  const o = data.order;
  const partnerAccepted = !!o.partnerAcceptedAt;
  const canAssignPickup =
    partnerAccepted &&
    (o.status === 'shop_assigned' || o.status === 'confirmed') &&
    !o.pickupRiderId;
  const canAssignDelivery =
    partnerAccepted &&
    o.status === 'ready_for_delivery' &&
    !o.deliveryRiderId &&
    o.fulfillmentType !== 'customer_pickup';
  const canMarkCustomerPickup = o.status === 'ready_for_delivery' && o.fulfillmentType !== 'customer_pickup';
  const canCompleteCustomerPickup = o.status === 'customer_pickup';
  const awaitingPartnerAccept =
    !!o.branchName &&
    o.dispatchStatus === 'dispatched' &&
    !partnerAccepted &&
    (o.status === 'shop_assigned' ||
      o.status === 'confirmed' ||
      o.status === 'ready_for_delivery');

  const opsState = deriveOrderOpsState(o, {
    awaitingPartnerAccept,
    canAssignPickup,
    canAssignDelivery,
  });
  const opsCopy = orderOpsCopy[opsState];

  return (
    <div>
      <header className="mb-8">
        <Link
          href="/orders"
          className="mb-3 inline-flex items-center text-sm text-muted transition-colors hover:text-primary"
        >
          ← Orders
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Order operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              <span className="text-code">{formatOrderId(o._id, 12)}</span>
            </h1>
            <p className="mt-2 text-sm text-muted sm:text-base">
              <span className="badge-neutral capitalize">{formatSlugLabel(o.status)}</span>
              {o.fulfillmentType === 'customer_pickup' ? (
                <span className="ml-2 badge-warning capitalize">Customer pickup</span>
              ) : null}
              {' · '}
              {o.branchName ?? 'No shop assigned'}
              {' · '}
              SLA: {o.sla.label}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {o.operationsConflict ? (
              <span className="badge-danger">Conflict flagged</span>
            ) : null}
            {o.status === 'pending_dispatch' ? (
              <Link href="/dispatch" className="btn-primary btn-sm">
                Dispatch to shop
              </Link>
            ) : (
              <Link href="/control-tower" className="btn-outline btn-sm">
                Control tower
              </Link>
            )}
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void reload()}
              disabled={busy}
            >
              Sync
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${opsCopy.bar}`}>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opsCopy.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{opsCopy.label}</p>
          <p className="text-xs text-muted">{opsCopy.detail}</p>
        </div>
        {o.operationsConflict ? (
          <span className="badge-danger px-3 py-1 text-xs font-semibold">Conflict</span>
        ) : null}
        {o.sla.status === 'breached' ? (
          <span className="badge-danger px-3 py-1 text-xs font-semibold">SLA breached</span>
        ) : o.sla.status === 'warning' ? (
          <span className="badge-warning px-3 py-1 text-xs font-semibold">SLA warning</span>
        ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCell
          label="Pipeline"
          value={formatSlugLabel(o.status)}
          highlight={
            o.status === 'pending_dispatch'
              ? 'warning'
              : o.status === 'completed'
                ? 'accent'
                : undefined
          }
        />
        <MetricCell
          label="Shop"
          value={o.branchName ?? 'Unassigned'}
          href={o.status === 'pending_dispatch' ? '/dispatch' : undefined}
          highlight={!o.branchName ? 'warning' : undefined}
        />
        <MetricCell
          label="Partner"
          value={partnerAccepted ? 'Accepted' : awaitingPartnerAccept ? 'Awaiting' : '—'}
          highlight={awaitingPartnerAccept ? 'warning' : partnerAccepted ? 'accent' : undefined}
        />
        <MetricCell
          label="Riders"
          value={
            o.pickupRiderId && o.deliveryRiderId
              ? 'Both assigned'
              : o.pickupRiderId
                ? 'Pickup only'
                : o.deliveryRiderId
                  ? 'Delivery only'
                  : canAssignPickup || canAssignDelivery
                    ? 'Needs assign'
                    : '—'
          }
          highlight={canAssignPickup || canAssignDelivery ? 'primary' : undefined}
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

        {error ? (
          <div className="alert-error" role="alert">
            {error}
          </div>
        ) : null}

        <OpsPanel title="Order snapshot">
          <dl>
            <DetailRow
              label="Pipeline"
              value={<span className="capitalize">{formatSlugLabel(o.status)}</span>}
            />
            <DetailRow label="Service" value={<span className="capitalize">{formatSlugLabel(o.bookingType)}</span>} />
            <DetailRow label="Shop" value={o.branchName ?? 'Not dispatched'} />
            <DetailRow label="SLA" value={o.sla.label} />
            <DetailRow label="Partner accepted" value={o.partnerAcceptedAt ? 'Yes' : 'No'} />
            <DetailRow label="Pickup requested" value={o.pickupRequestedAt ? 'Yes' : 'No'} />
            <DetailRow label="Customer" value={data.customer?.email ?? data.customer?.phone ?? '—'} />
          </dl>
        </OpsPanel>

        {o.paymentMethod ? (
          <OpsPanel title="Payment">
            <dl>
              <DetailRow label="Method" value={<span className="capitalize">{formatSlugLabel(o.paymentMethod)}</span>} />
              <DetailRow label="Status" value={<span className="capitalize">{formatSlugLabel(o.paymentStatus ?? 'unknown')}</span>} />
              {o.paymentAmount != null ? (
                <DetailRow label="Amount" value={`₱${o.paymentAmount.toFixed(2)}`} />
              ) : null}
              {o.cashTiming ? (
                <DetailRow label="Cash timing" value={<span className="capitalize">{o.cashTiming.replace(/_/g, ' ')}</span>} />
              ) : null}
              {o.paymentReceiptCode ? (
                <DetailRow label="Receipt ref" value={<span className="font-mono text-sm">{o.paymentReceiptCode}</span>} />
              ) : null}
              {o.paymentPaidAt ? (
                <DetailRow label="Paid at" value={new Date(o.paymentPaidAt).toLocaleString()} />
              ) : null}
              {o.cashCollectedBy ? (
                <DetailRow label="Collected by rider" value={o.cashCollectedBy} />
              ) : null}
            </dl>
          </OpsPanel>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <OpsPanel
            title="Pickup rider"
            description="After partner accepts — status becomes rider_assigned_pickup."
          >
            {awaitingPartnerAccept &&
              (o.status === 'shop_assigned' || o.status === 'confirmed') &&
              !o.pickupRiderId && (
                <p className="text-sm text-amber-800">
                  Partner must accept in the partner portal before pickup assignment or marketplace
                  broadcast.
                </p>
              )}

            {!canAssignPickup && !awaitingPartnerAccept && !o.pickupRiderId ? (
              <p className="text-sm text-muted">Not ready for pickup rider assignment.</p>
            ) : null}

            {o.pickupRiderId ? (
              <p className="text-sm text-muted">
                Pickup rider assigned ·{' '}
                <span className="text-code">{o.pickupRiderId.slice(-8)}</span>
              </p>
            ) : null}

            {canAssignPickup && (
              <>
                {data.pickupRiderSuggestions && data.pickupRiderSuggestions.suggestions.length > 0 && (
                  <div className="rounded-lg border border-border/60 bg-slate-50/80 p-3 text-sm">
                    <p className="font-medium text-slate-900">System suggestion</p>
                    <ul className="mt-2 space-y-1">
                      {data.pickupRiderSuggestions.suggestions.slice(0, 3).map((s) => (
                        <li key={s.userId} className="flex justify-between gap-2 text-slate-700">
                          <span>
                            #{s.rank} {s.email ?? s.userId}
                            {s.isRecommended ? ' ★' : ''}
                          </span>
                          <span className="text-muted">
                            {s.distanceLabel} · {s.recommendationScore}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="dc-form-actions mt-4 border-0 pt-0">
                  <button
                    type="button"
                    disabled={busy}
                    className="btn-outline btn-sm"
                    onClick={() =>
                      run(async () => {
                        const res = await adminFetch<{
                          suggestedRiderId: string | null;
                        }>(`/admin/operations/orders/${id}/suggest-pickup-rider`);
                        if (res.suggestedRiderId) setRiderId(res.suggestedRiderId);
                        setAssignType('pickup');
                      })
                    }
                  >
                    Auto-suggest
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="btn-primary btn-sm"
                    onClick={() =>
                      run(() =>
                        adminFetch(`/admin/operations/orders/${id}/confirm-pickup-rider`, {
                          method: 'POST',
                          body: JSON.stringify({
                            riderId: riderId || data.suggestedPickupRiderId || undefined,
                            type: 'pickup',
                          }),
                        }),
                      )
                    }
                  >
                    Confirm suggested
                  </button>
                </div>
              </>
            )}
          </OpsPanel>

          <OpsPanel
            title="Delivery rider"
            description="When ready_for_delivery — status becomes rider_assigned_delivery."
          >
            {awaitingPartnerAccept && o.status === 'ready_for_delivery' && !o.deliveryRiderId && (
              <p className="text-sm text-amber-800">
                Partner must accept before you can assign a delivery rider.
              </p>
            )}

            {!canAssignDelivery && !o.deliveryRiderId && o.status !== 'ready_for_delivery' ? (
              <p className="text-sm text-muted">Not ready for delivery rider assignment.</p>
            ) : null}

            {o.deliveryRiderId ? (
              <p className="text-sm text-muted">
                Delivery rider assigned ·{' '}
                <span className="text-code">{o.deliveryRiderId.slice(-8)}</span>
              </p>
            ) : null}

            {canAssignDelivery && (
              <>
                {data.deliveryRiderSuggestions &&
                  data.deliveryRiderSuggestions.suggestions.length > 0 && (
                    <div className="rounded-lg border border-border/60 bg-slate-50/80 p-3 text-sm">
                      <p className="font-medium text-slate-900">Delivery suggestion</p>
                      <ul className="mt-2 space-y-1">
                        {data.deliveryRiderSuggestions.suggestions.slice(0, 3).map((s) => (
                          <li key={s.userId} className="flex justify-between gap-2 text-slate-700">
                            <span>
                              #{s.rank} {s.email ?? s.userId}
                              {s.isRecommended ? ' ★' : ''}
                            </span>
                            <span className="text-muted">
                              {s.distanceLabel} · {s.recommendationScore}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                <div className="dc-form-actions mt-4 border-0 pt-0">
                  <button
                    type="button"
                    disabled={busy}
                    className="btn-outline btn-sm"
                    onClick={() =>
                      run(async () => {
                        const res = await adminFetch<{
                          suggestedRiderId: string | null;
                        }>(`/admin/operations/orders/${id}/suggest-delivery-rider`);
                        if (res.suggestedRiderId) setRiderId(res.suggestedRiderId);
                        setAssignType('delivery');
                      })
                    }
                  >
                    Auto-suggest
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="btn-primary btn-sm"
                    onClick={() =>
                      run(() =>
                        adminFetch(`/admin/operations/orders/${id}/confirm-delivery-rider`, {
                          method: 'POST',
                          body: JSON.stringify({
                            riderId: riderId || data.suggestedDeliveryRiderId || undefined,
                          }),
                        }),
                      )
                    }
                  >
                    Confirm suggested
                  </button>
                </div>
              </>
            )}
          </OpsPanel>
        </div>

        <OpsPanel
          title="Customer self-pickup"
          description="Customer collects laundry at the shop — bypasses delivery rider."
        >
          {o.customerPickupAt ? (
            <p className="text-sm text-muted">
              Collected at {new Date(o.customerPickupAt).toLocaleString()}
            </p>
          ) : o.fulfillmentType === 'customer_pickup' ? (
            <p className="text-sm text-amber-800">Waiting for customer to collect at the shop.</p>
          ) : (
            <p className="text-sm text-muted">
              {o.status === 'ready_for_delivery'
                ? 'Mark this order as customer pickup to skip delivery rider assignment.'
                : 'Available when order is ready_for_delivery.'}
            </p>
          )}
          <div className="dc-form-actions mt-4 border-0 pt-0">
            {canMarkCustomerPickup && (
              <button
                type="button"
                disabled={busy}
                className="btn-outline btn-sm"
                onClick={() =>
                  run(() =>
                    adminFetch(`/orders/${id}/customer-pickup`, { method: 'POST' }),
                  )
                }
              >
                Mark as customer pickup
              </button>
            )}
            {canCompleteCustomerPickup && (
              <button
                type="button"
                disabled={busy}
                className="btn-primary btn-sm"
                onClick={() =>
                  run(() =>
                    adminFetch(`/orders/${id}/customer-pickup/complete`, { method: 'POST' }),
                  )
                }
              >
                Confirm customer collected
              </button>
            )}
          </div>
        </OpsPanel>

        <OpsPanel
          title="Manual assignment"
          description="Override suggestions or broadcast pickup to the rider marketplace."
        >
          <div className="dc-form-grid max-w-2xl">
            <div className="sm:col-span-2">
              <label htmlFor="manual-rider" className="form-label">
                Rider
              </label>
              <select
                id="manual-rider"
                className="input-field disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canAssignPickup && !canAssignDelivery}
                value={riderId || data.suggestedPickupRiderId || ''}
                onChange={(e) => setRiderId(e.target.value)}
              >
                <option value="">Select rider…</option>
                {(assignType === 'delivery'
                  ? data.deliveryRiderSuggestions?.suggestions
                  : data.pickupRiderSuggestions?.suggestions
                )?.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    #{s.rank} {s.email ?? s.userId} — {s.recommendationScore}
                  </option>
                ))}
                {data.availableRiders.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.email ?? r.userId} {r.isOnline ? '(online)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="assign-type" className="form-label">
                Assignment type
              </label>
              <select
                id="assign-type"
                className="input-field disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canAssignPickup && !canAssignDelivery}
                value={assignType}
                onChange={(e) => setAssignType(e.target.value as 'pickup' | 'delivery')}
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
          </div>
          <div className="dc-form-actions mt-4">
            <button
              type="button"
              disabled={
                busy ||
                (assignType === 'delivery' ? !canAssignDelivery : !canAssignPickup) ||
                !(riderId ||
                  (assignType === 'delivery'
                    ? data.suggestedDeliveryRiderId
                    : data.suggestedPickupRiderId))
              }
              className="btn-primary btn-sm disabled:opacity-50"
              onClick={() =>
                run(() =>
                  adminFetch(`/admin/operations/orders/${id}/assign-rider`, {
                    method: 'POST',
                    body: JSON.stringify({
                      riderId:
                        riderId ||
                        (assignType === 'delivery'
                          ? data.suggestedDeliveryRiderId
                          : data.suggestedPickupRiderId),
                      type: assignType,
                    }),
                  }),
                )
              }
            >
              Assign rider directly
            </button>
            <button
              type="button"
              disabled={busy || !canAssignPickup}
              className="btn-outline btn-sm disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() =>
                run(() =>
                  adminFetch(`/admin/operations/orders/${id}/dispatch-pickup`, { method: 'POST' }),
                )
              }
            >
              Broadcast pickup offer
            </button>
          </div>
        </OpsPanel>

        <OpsPanel
          title="Conflicts"
          description="Flag operational issues or resolve an existing conflict."
          headerAction={
            <Link href="/support" className="link-primary text-xs font-medium">
              Support →
            </Link>
          }
        >
          {o.operationsConflict && o.operationsConflictNote ? (
            <div className="alert-error mb-3 text-sm">{o.operationsConflictNote}</div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="conflict-note" className="form-label">
                Flag conflict
              </label>
              <input
                id="conflict-note"
                className="input-field"
                placeholder="Describe the issue…"
                value={conflictNote}
                onChange={(e) => setConflictNote(e.target.value)}
              />
              <div className="mt-3">
                <button
                  type="button"
                  disabled={busy || !conflictNote}
                  className="btn-outline btn-sm"
                  onClick={() =>
                    run(() =>
                      adminFetch(`/admin/operations/orders/${id}/flag-conflict`, {
                        method: 'POST',
                        body: JSON.stringify({ note: conflictNote }),
                      }),
                    )
                  }
                >
                  Flag conflict
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="resolution-note" className="form-label">
                Resolve conflict
              </label>
              <input
                id="resolution-note"
                className="input-field"
                placeholder="Resolution note…"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
              <div className="mt-3">
                <button
                  type="button"
                  disabled={busy || !resolution}
                  className="btn-primary btn-sm"
                  onClick={() =>
                    run(() =>
                      adminFetch(`/admin/operations/orders/${id}/resolve-conflict`, {
                        method: 'POST',
                        body: JSON.stringify({ resolution }),
                      }),
                    )
                  }
                >
                  Resolve conflict
                </button>
              </div>
            </div>
          </div>
        </OpsPanel>
      </div>
    </div>
  );
}
