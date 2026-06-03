'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageHeader } from '../../../components/ui/page-header';
import { DetailRow, OpsPanel } from '../../../components/ui/ops-panel';
import { adminFetch } from '../../../lib/admin-api';
import { formatSlugLabel } from '../../../lib/format-label';
import { useAdminQuery } from '../../../lib/use-admin-query';

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
        <PageHeader title="Order operations" backHref="/orders" backLabel="Orders" />
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
    partnerAccepted && o.status === 'ready_for_delivery' && !o.deliveryRiderId;
  const awaitingPartnerAccept =
    !!o.branchName &&
    o.dispatchStatus === 'dispatched' &&
    !partnerAccepted &&
    (o.status === 'shop_assigned' ||
      o.status === 'confirmed' ||
      o.status === 'ready_for_delivery');

  return (
    <div>
      <PageHeader
        title="Order operations"
        description={<span className="font-mono text-xs">{o._id}</span>}
        backHref="/orders"
        backLabel="Orders"
        actions={
          o.status === 'pending_dispatch' ? (
            <Link href="/dispatch" className="btn-primary btn-sm">
              Dispatch to shop
            </Link>
          ) : undefined
        }
      />

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <OpsPanel title="Status">
          <dl className="space-y-2">
            <DetailRow label="Pipeline" value={<span className="capitalize">{formatSlugLabel(o.status)}</span>} />
            <DetailRow label="Shop" value={o.branchName ?? 'Not dispatched'} />
            <DetailRow label="SLA" value={o.sla.label} />
            <DetailRow label="Partner accepted" value={o.partnerAcceptedAt ? 'Yes' : 'No'} />
            <DetailRow label="Pickup requested" value={o.pickupRequestedAt ? 'Yes' : 'No'} />
            <DetailRow label="Customer" value={data.customer?.email ?? data.customer?.phone ?? '—'} />
          </dl>
        </OpsPanel>

        <OpsPanel
          title="Assign delivery rider"
          description="When laundry is ready_for_delivery — status becomes rider_assigned_delivery. Rider is notified in-app."
        >
          {awaitingPartnerAccept && o.status === 'ready_for_delivery' && !o.deliveryRiderId && (
            <p className="mt-4 text-sm text-amber-800">
              Partner must accept this order before you can assign a delivery rider.
            </p>
          )}

          {canAssignDelivery && (
            <>
              {data.deliveryRiderSuggestions &&
                data.deliveryRiderSuggestions.suggestions.length > 0 && (
                  <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm">
                    <p className="font-medium text-emerald-900">Delivery suggestion</p>
                    <ul className="mt-2 space-y-1">
                      {data.deliveryRiderSuggestions.suggestions.slice(0, 3).map((s) => (
                        <li key={s.userId} className="flex justify-between text-slate-700">
                          <span>
                            #{s.rank} {s.email ?? s.userId}
                            {s.isRecommended ? ' ★' : ''}
                          </span>
                          <span className="text-slate-500">
                            {s.distanceLabel} · score {s.recommendationScore}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="btn-outline btn-sm border-emerald-300 text-emerald-800"
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
                  Auto-suggest delivery rider
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-600/90"
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
                  Confirm suggested delivery rider
                </button>
              </div>
            </>
          )}
        </OpsPanel>

        <OpsPanel
          title="Assign pickup rider"
          description="After partner accepts at the shop — status becomes rider_assigned_pickup. Rider is notified in-app."
        >
          {awaitingPartnerAccept &&
            (o.status === 'shop_assigned' || o.status === 'confirmed') &&
            !o.pickupRiderId && (
              <p className="mt-4 text-sm text-amber-800">
                Partner must accept this order in the partner portal before you can assign a pickup
                rider or broadcast to the marketplace.
              </p>
            )}

          {canAssignPickup && (
            <>
              {data.pickupRiderSuggestions && data.pickupRiderSuggestions.suggestions.length > 0 && (
                <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm">
                  <p className="font-medium text-indigo-900">System suggestion</p>
                  <ul className="mt-2 space-y-1">
                    {data.pickupRiderSuggestions.suggestions.slice(0, 3).map((s) => (
                      <li key={s.userId} className="flex justify-between text-slate-700">
                        <span>
                          #{s.rank} {s.email ?? s.userId}
                          {s.isRecommended ? ' ★' : ''}
                        </span>
                        <span className="text-slate-500">
                          {s.distanceLabel} · score {s.recommendationScore}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="btn-outline btn-sm"
                  onClick={() =>
                    run(async () => {
                      const res = await adminFetch<{
                        suggestedRiderId: string | null;
                        suggestions: RiderSuggestion[];
                      }>(`/admin/operations/orders/${id}/suggest-pickup-rider`);
                      if (res.suggestedRiderId) setRiderId(res.suggestedRiderId);
                    })
                  }
                >
                  Auto-suggest rider
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="btn-primary btn-sm disabled:opacity-50"
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
                  Confirm suggested rider
                </button>
              </div>
            </>
          )}

          <select
            className="input-field mt-4 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canAssignPickup && !canAssignDelivery}
            value={riderId || data.suggestedPickupRiderId || ''}
            onChange={(e) => setRiderId(e.target.value)}
          >
            <option value="">Select rider (manual)…</option>
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
          <select
            className="input-field mt-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canAssignPickup && !canAssignDelivery}
            value={assignType}
            onChange={(e) => setAssignType(e.target.value as 'pickup' | 'delivery')}
          >
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
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
            className="btn-primary mt-3 w-full disabled:opacity-50"
            onClick={() =>
              run(() =>
                adminFetch(`/admin/operations/orders/${id}/assign-rider`, {
                  method: 'POST',
                  body: JSON.stringify({
                    riderId: riderId || data.suggestedPickupRiderId,
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
            className="btn-outline mt-2 w-full disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() =>
              run(() =>
                adminFetch(`/admin/operations/orders/${id}/dispatch-pickup`, { method: 'POST' }),
              )
            }
          >
            Broadcast to marketplace (riders accept)
          </button>
        </OpsPanel>
      </div>

      <OpsPanel title="Conflicts" className="mt-6 lg:col-span-2 xl:col-span-3">
        {o.operationsConflict && (
          <p className="text-sm text-destructive">{o.operationsConflictNote}</p>
        )}
        <input
          className="input-field mt-3"
          placeholder="Conflict note"
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
        <input
          className="input-field mt-4"
          placeholder="Resolution note"
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
        <Link href="/support" className="link-primary mt-3 inline-block text-sm">
          Open support tickets →
        </Link>
      </OpsPanel>
    </div>
  );
}
