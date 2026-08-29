'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface RiderProfile {
  userId: string;
  firstName?: string;
  lastName?: string;
  isOnline?: boolean;
  shiftStatus?: string;
  vehicleType?: string;
  plateNumber?: string;
  user?: { phone?: string; email?: string } | null;
}

function RiderMiniCard({ riderId, label }: { riderId: string; label: string }) {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminFetch<RiderProfile>(`/admin/riders/${riderId}/profile`)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [riderId]);

  const name =
    profile?.firstName || profile?.lastName
      ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
      : profile?.user?.email ?? riderId.slice(-8).toUpperCase();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-slate-50/80 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/70">{label}</p>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-medium text-slate-900">{name}</span>
            {profile?.user?.phone && <span className="text-muted">{profile.user.phone}</span>}
            {profile?.vehicleType && (
              <span className="text-muted capitalize">
                {formatSlugLabel(profile.vehicleType)}{profile.plateNumber ? ` · ${profile.plateNumber}` : ''}
              </span>
            )}
          </div>
        )}
      </div>
      {!loading && (
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${profile?.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="text-xs text-muted">{profile?.isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
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
  ) return 'attention';
  return 'nominal';
}

const orderOpsCopy: Record<OrderOpsState, { label: string; detail: string; dot: string; bar: string }> = {
  nominal:   { label: 'Order on track',     detail: 'No conflicts, SLA within bounds, no pending dispatch actions.', dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]', bar: 'border-emerald-500/30 bg-emerald-950/5' },
  attention: { label: 'Action required',    detail: 'Dispatch, partner accept, or rider assignment may be needed.',  dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',  bar: 'border-amber-500/35 bg-amber-950/5'   },
  critical:  { label: 'Critical exception', detail: 'SLA breach or operational conflict — review and resolve.',       dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',    bar: 'border-red-500/35 bg-red-950/5'       },
};

function RiderSuggestionList({ suggestions, label }: { suggestions: RiderSuggestion[]; label: string }) {
  if (!suggestions.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-slate-50/80 p-3 text-sm">
      <p className="font-medium text-slate-900">{label}</p>
      <ul className="mt-2 space-y-1">
        {suggestions.slice(0, 3).map((s) => (
          <li key={s.userId} className="flex justify-between gap-2 text-slate-700">
            <span>#{s.rank} {s.email ?? s.userId}{s.isRecommended ? ' ★' : ''}</span>
            <span className="text-muted">{s.distanceLabel} · {s.recommendationScore}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminOrderOpsPage() {
  const { id } = useParams<{ id: string }>();
  const [riderId, setRiderId] = useState('');
  const [assignType, setAssignType] = useState<'pickup' | 'delivery'>('pickup');
  const [reassignMode, setReassignMode] = useState(false);
  const [conflictNote, setConflictNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) throw new Error('Order not found');
    return adminFetch<OpsData>(`/admin/operations/orders/${id}`);
  }, [id]);

  const { data, loading, error: loadError, reload } = useAdminQuery(load, [id]);

  useAdminOperationsSocket({
    onDispatchQueueUpdated: () => { void reload(); },
    onDispatcherAlert: (alert) => { if (alert.orderId === id) void reload(); },
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
        <Link href="/orders" className="mb-3 inline-flex items-center text-sm text-muted transition-colors hover:text-primary">
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
  const canReassignPickup = !!o.pickupRiderId && o.status === 'rider_assigned_pickup';
  const canReassignDelivery =
    !!o.deliveryRiderId &&
    o.status === 'rider_assigned_delivery' &&
    o.fulfillmentType !== 'customer_pickup';
  const canMarkCustomerPickup = o.status === 'ready_for_delivery' && o.fulfillmentType !== 'customer_pickup';
  const canCompleteCustomerPickup = o.status === 'customer_pickup';
  const awaitingPartnerAccept =
    !!o.branchName &&
    o.dispatchStatus === 'dispatched' &&
    !partnerAccepted &&
    (o.status === 'shop_assigned' || o.status === 'confirmed' || o.status === 'ready_for_delivery');

  const canCancelOrder = !['completed', 'cancelled', 'refunded'].includes(o.status);

  const opsState = deriveOrderOpsState(o, { awaitingPartnerAccept, canAssignPickup, canAssignDelivery });
  const opsCopy = orderOpsCopy[opsState];

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="mb-6">
        <Link href="/orders" className="mb-3 inline-flex items-center text-sm text-muted transition-colors hover:text-primary">
          ← Orders
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="dc-eyebrow">Order operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              <span className="text-code">{formatOrderId(o._id, 12)}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="badge-neutral capitalize">{formatSlugLabel(o.status)}</span>
              {o.fulfillmentType === 'customer_pickup' && (
                <span className="badge-warning capitalize">Customer pickup</span>
              )}
              {o.operationsConflict && <span className="badge-danger">Conflict</span>}
              {o.sla.status === 'breached' && <span className="badge-danger">SLA breached</span>}
              {o.sla.status === 'warning' && <span className="badge-warning">SLA warning</span>}
              <span className="text-muted">·</span>
              <span>{o.branchName ?? 'No shop assigned'}</span>
              <span className="text-muted">·</span>
              <span>SLA: {o.sla.label}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {o.status === 'pending_dispatch' ? (
              <Link href="/dispatch" className="btn-primary btn-sm">Dispatch to shop</Link>
            ) : (
              <Link href="/control-tower" className="btn-outline btn-sm">Control tower</Link>
            )}
            <button type="button" className="btn-outline btn-sm" onClick={() => void reload()} disabled={busy}>
              Sync
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {/* ── Pipeline state banner ────────────────────────────────── */}
        <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${opsCopy.bar}`}>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opsCopy.dot}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{opsCopy.label}</p>
            <p className="text-xs text-muted">{opsCopy.detail}</p>
          </div>
          {o.operationsConflict && <span className="badge-danger px-3 py-1 text-xs font-semibold">Conflict</span>}
          {o.sla.status === 'breached' && <span className="badge-danger px-3 py-1 text-xs font-semibold">SLA breached</span>}
          {o.sla.status === 'warning' && <span className="badge-warning px-3 py-1 text-xs font-semibold">SLA warning</span>}
        </div>

        {/* ── Metric row ───────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell
            label="Pipeline"
            value={formatSlugLabel(o.status)}
            highlight={o.status === 'pending_dispatch' ? 'warning' : o.status === 'completed' ? 'accent' : undefined}
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
              o.pickupRiderId && o.deliveryRiderId ? 'Both assigned'
              : o.pickupRiderId ? 'Pickup only'
              : o.deliveryRiderId ? 'Delivery only'
              : canAssignPickup || canAssignDelivery ? 'Needs assign'
              : '—'
            }
            highlight={canAssignPickup || canAssignDelivery ? 'primary' : undefined}
          />
        </div>

        {error && <div className="alert-error" role="alert">{error}</div>}

        {/* ── Two-column body ──────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-3">

          {/* Left column — order info + fulfillment */}
          <div className="space-y-4 lg:col-span-2">

            {/* Order & customer details */}
            <OpsPanel title="Order details">
              <dl>
                <DetailRow label="Service"          value={<span className="capitalize">{formatSlugLabel(o.bookingType)}</span>} />
                <DetailRow label="Shop"             value={o.branchName ?? 'Not dispatched'} />
                <DetailRow label="SLA"              value={o.sla.label} />
                <DetailRow label="Partner accepted" value={o.partnerAcceptedAt ? new Date(o.partnerAcceptedAt).toLocaleString() : 'No'} />
                <DetailRow label="Pickup requested" value={o.pickupRequestedAt ? new Date(o.pickupRequestedAt).toLocaleString() : 'No'} />
                <DetailRow label="Customer"         value={data.customer?.email ?? data.customer?.phone ?? '—'} />
              </dl>
              {o.paymentMethod && (
                <>
                  <div className="my-3 border-t border-border/60" />
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted/70">Payment</p>
                  <dl>
                    <DetailRow label="Method"     value={<span className="capitalize">{formatSlugLabel(o.paymentMethod)}</span>} />
                    <DetailRow label="Status"     value={<span className="capitalize">{formatSlugLabel(o.paymentStatus ?? 'unknown')}</span>} />
                    {o.paymentAmount != null && <DetailRow label="Amount" value={`₱${o.paymentAmount.toFixed(2)}`} />}
                    {o.cashTiming    && <DetailRow label="Cash timing"  value={<span className="capitalize">{o.cashTiming.replace(/_/g, ' ')}</span>} />}
                    {o.paymentReceiptCode && <DetailRow label="Receipt ref" value={<span className="font-mono text-sm">{o.paymentReceiptCode}</span>} />}
                    {o.paymentPaidAt && <DetailRow label="Paid at"      value={new Date(o.paymentPaidAt).toLocaleString()} />}
                    {o.cashCollectedBy && (
                      /^[a-f0-9]{24}$/i.test(o.cashCollectedBy) ? (
                        <RiderMiniCard riderId={o.cashCollectedBy} label="Collected by" />
                      ) : (
                        <DetailRow label="Collected by" value={o.cashCollectedBy} />
                      )
                    )}
                  </dl>
                </>
              )}
            </OpsPanel>

            {/* Rider assignment — pickup + delivery + customer pickup in one panel */}
            <OpsPanel title="Fulfillment & riders">
              <div className="space-y-3">

                {/* Pickup */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted/70">Pickup rider</p>
                  {o.pickupRiderId ? (
                    <div className="space-y-2">
                      <RiderMiniCard riderId={o.pickupRiderId} label="Assigned pickup rider" />
                      {canReassignPickup && (
                        <button
                          type="button"
                          className="link-primary text-xs font-medium"
                          onClick={() => {
                            setAssignType('pickup');
                            setReassignMode(true);
                            setRiderId('');
                          }}
                        >
                          Reassign to another rider →
                        </button>
                      )}
                    </div>
                  ) : awaitingPartnerAccept && (o.status === 'shop_assigned' || o.status === 'confirmed') ? (
                    <p className="text-sm text-amber-800">Partner must accept before pickup assignment.</p>
                  ) : !canAssignPickup ? (
                    <p className="text-sm text-muted">Not ready for pickup rider assignment.</p>
                  ) : (
                    <div className="space-y-3">
                      <RiderSuggestionList suggestions={data.pickupRiderSuggestions?.suggestions ?? []} label="System suggestion" />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className="btn-outline btn-sm"
                          onClick={() =>
                            run(async () => {
                              const res = await adminFetch<{ suggestedRiderId: string | null }>(
                                `/admin/operations/orders/${id}/suggest-pickup-rider`,
                              );
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
                                body: JSON.stringify({ riderId: riderId || data.suggestedPickupRiderId || undefined, type: 'pickup' }),
                              }),
                            )
                          }
                        >
                          Confirm suggested
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-border/60" />

                {/* Delivery */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted/70">Delivery rider</p>
                  {o.deliveryRiderId ? (
                    <div className="space-y-2">
                      <RiderMiniCard riderId={o.deliveryRiderId} label="Assigned delivery rider" />
                      {canReassignDelivery && (
                        <button
                          type="button"
                          className="link-primary text-xs font-medium"
                          onClick={() => {
                            setAssignType('delivery');
                            setReassignMode(true);
                            setRiderId('');
                          }}
                        >
                          Reassign to another rider →
                        </button>
                      )}
                    </div>
                  ) : o.fulfillmentType === 'customer_pickup' ? (
                    <p className="text-sm text-muted">Customer pickup — no delivery rider needed.</p>
                  ) : awaitingPartnerAccept && o.status === 'ready_for_delivery' ? (
                    <p className="text-sm text-amber-800">Partner must accept before delivery rider assignment.</p>
                  ) : !canAssignDelivery ? (
                    <p className="text-sm text-muted">Not ready for delivery rider assignment.</p>
                  ) : (
                    <div className="space-y-3">
                      <RiderSuggestionList suggestions={data.deliveryRiderSuggestions?.suggestions ?? []} label="Delivery suggestion" />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className="btn-outline btn-sm"
                          onClick={() =>
                            run(async () => {
                              const res = await adminFetch<{ suggestedRiderId: string | null }>(
                                `/admin/operations/orders/${id}/suggest-delivery-rider`,
                              );
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
                                body: JSON.stringify({ riderId: riderId || data.suggestedDeliveryRiderId || undefined }),
                              }),
                            )
                          }
                        >
                          Confirm suggested
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer pickup section — only shown when relevant */}
                {(canMarkCustomerPickup || canCompleteCustomerPickup || o.fulfillmentType === 'customer_pickup') && (
                  <>
                    <div className="border-t border-border/60" />
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted/70">Customer self-pickup</p>
                      {o.customerPickupAt ? (
                        <p className="text-sm text-muted">Collected at {new Date(o.customerPickupAt).toLocaleString()}</p>
                      ) : o.fulfillmentType === 'customer_pickup' ? (
                        <p className="text-sm text-amber-800">Waiting for customer to collect at the shop.</p>
                      ) : (
                        <p className="text-sm text-muted">Mark as customer pickup to skip delivery rider assignment.</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        {canMarkCustomerPickup && (
                          <button
                            type="button"
                            disabled={busy}
                            className="btn-outline btn-sm"
                            onClick={() => run(() => adminFetch(`/orders/${id}/customer-pickup`, { method: 'POST' }))}
                          >
                            Mark as customer pickup
                          </button>
                        )}
                        {canCompleteCustomerPickup && (
                          <button
                            type="button"
                            disabled={busy}
                            className="btn-primary btn-sm"
                            onClick={() => run(() => adminFetch(`/orders/${id}/customer-pickup/complete`, { method: 'POST' }))}
                          >
                            Confirm customer collected
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </OpsPanel>
          </div>

          {/* Right column — manual override + conflicts */}
          <div className="space-y-4">

            <OpsPanel
              title="Manual assignment"
              description={
                reassignMode
                  ? 'Reassigning the current rider to a different one.'
                  : 'Override suggestions or broadcast to marketplace.'
              }
            >
              {(() => {
                const canAssignActive = assignType === 'delivery' ? canAssignDelivery : canAssignPickup;
                const canReassignActive = assignType === 'delivery' ? canReassignDelivery : canReassignPickup;
                const activeMode = reassignMode && canReassignActive ? 'reassign' : canAssignActive ? 'assign' : null;
                const typeSelectDisabled =
                  !canAssignPickup && !canAssignDelivery && !canReassignPickup && !canReassignDelivery;

                return (
                  <>
                    {reassignMode && (
                      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                        <span>Reassign mode — pick a new rider below.</span>
                        <button
                          type="button"
                          className="font-medium text-amber-900 hover:underline"
                          onClick={() => {
                            setReassignMode(false);
                            setRiderId('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="assign-type" className="form-label">Type</label>
                        <select
                          id="assign-type"
                          className="input-field disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={typeSelectDisabled}
                          value={assignType}
                          onChange={(e) => {
                            setAssignType(e.target.value as 'pickup' | 'delivery');
                            setRiderId('');
                          }}
                        >
                          <option value="pickup">Pickup</option>
                          <option value="delivery">Delivery</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="manual-rider" className="form-label">Rider</label>
                        <select
                          id="manual-rider"
                          className="input-field disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!activeMode}
                          value={
                            riderId ||
                            (activeMode === 'assign'
                              ? (assignType === 'delivery'
                                  ? data.suggestedDeliveryRiderId
                                  : data.suggestedPickupRiderId) ?? ''
                              : '')
                          }
                          onChange={(e) => setRiderId(e.target.value)}
                        >
                          <option value="">Select rider…</option>
                          {(() => {
                            const suggestions =
                              (assignType === 'delivery'
                                ? data.deliveryRiderSuggestions?.suggestions
                                : data.pickupRiderSuggestions?.suggestions) ?? [];
                            const suggestedIds = new Set(suggestions.map((s) => s.userId));
                            return (
                              <>
                                {suggestions.map((s) => (
                                  <option key={s.userId} value={s.userId}>
                                    #{s.rank} {s.email ?? s.userId} — {s.recommendationScore}
                                  </option>
                                ))}
                                {data.availableRiders
                                  .filter((r) => !suggestedIds.has(r.userId))
                                  .map((r) => (
                                    <option key={r.userId} value={r.userId}>
                                      {r.email ?? r.userId}{r.isOnline ? ' (online)' : ''}
                                    </option>
                                  ))}
                              </>
                            );
                          })()}
                        </select>
                      </div>
                    </div>
                    <div className="dc-form-actions mt-4">
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !activeMode ||
                          !(riderId || (activeMode === 'assign' && (assignType === 'delivery' ? data.suggestedDeliveryRiderId : data.suggestedPickupRiderId)))
                        }
                        className="btn-primary btn-sm disabled:opacity-50"
                        onClick={() =>
                          run(async () => {
                            const endpoint = activeMode === 'reassign' ? 'reassign-rider' : 'assign-rider';
                            await adminFetch(`/admin/operations/orders/${id}/${endpoint}`, {
                              method: 'POST',
                              body: JSON.stringify({
                                riderId: riderId || (assignType === 'delivery' ? data.suggestedDeliveryRiderId : data.suggestedPickupRiderId),
                                type: assignType,
                              }),
                            });
                            setReassignMode(false);
                            setRiderId('');
                          })
                        }
                      >
                        {activeMode === 'reassign' ? 'Reassign rider' : 'Assign directly'}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canAssignPickup}
                        className="btn-outline btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => run(() => adminFetch(`/admin/operations/orders/${id}/dispatch-pickup`, { method: 'POST' }))}
                      >
                        Broadcast pickup
                      </button>
                    </div>
                  </>
                );
              })()}
            </OpsPanel>

            <OpsPanel
              title="Conflicts"
              description="Flag issues or resolve an existing conflict."
              headerAction={<Link href="/support" className="link-primary text-xs font-medium">Support →</Link>}
            >
              {o.operationsConflict && o.operationsConflictNote && (
                <div className="alert-error mb-3 text-sm">{o.operationsConflictNote}</div>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="conflict-note" className="form-label">Flag conflict</label>
                  <input
                    id="conflict-note"
                    className="input-field"
                    placeholder="Describe the issue…"
                    value={conflictNote}
                    onChange={(e) => setConflictNote(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !conflictNote}
                    className="btn-outline btn-sm mt-2"
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
                <div>
                  <label htmlFor="resolution-note" className="form-label">Resolve conflict</label>
                  <input
                    id="resolution-note"
                    className="input-field"
                    placeholder="Resolution note…"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !resolution}
                    className="btn-primary btn-sm mt-2"
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
            </OpsPanel>

            {canCancelOrder && (
              <OpsPanel
                title="Cancel order"
                description="Cancels the order and refunds any paid amount to the customer's wallet."
              >
                <div>
                  <label htmlFor="cancel-reason" className="form-label">Reason</label>
                  <input
                    id="cancel-reason"
                    className="input-field"
                    placeholder="Why is this order being cancelled?"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={busy || !cancelReason.trim()}
                    className="btn-outline btn-sm mt-2 !border-red-300 !text-red-600 hover:!bg-red-50"
                    onClick={() => {
                      if (!window.confirm('Cancel this order? Any paid amount will be refunded to the wallet.')) return;
                      void run(() =>
                        adminFetch(`/admin/operations/orders/${id}/cancel`, {
                          method: 'POST',
                          body: JSON.stringify({ reason: cancelReason }),
                        }),
                      ).then(() => setCancelReason(''));
                    }}
                  >
                    Cancel order
                  </button>
                </div>
              </OpsPanel>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
