'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { DataPageStatus } from '../../../components/data-page-status';
import { adminFetch } from '../../../lib/admin-api';
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
        <Link href="/orders" className="text-sm text-primary">
          ← Orders
        </Link>
        <DataPageStatus loading={loading} error={loadError} loadingMessage="Loading order…" />
      </div>
    );
  }

  const o = data.order;

  return (
    <div>
      <Link href="/orders" className="text-sm text-primary">
        ← Orders
      </Link>
      <h2 className="mt-4 text-2xl font-bold">Order operations</h2>
      <p className="mt-1 font-mono text-xs text-slate-500">{o._id}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Status</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Pipeline</dt>
              <dd className="capitalize">{o.status.replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Shop</dt>
              <dd>{o.branchName ?? 'Not dispatched'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">SLA</dt>
              <dd>{o.sla.label}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Partner accepted</dt>
              <dd>{o.partnerAcceptedAt ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Pickup requested</dt>
              <dd>{o.pickupRequestedAt ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Customer</dt>
              <dd>{data.customer?.email ?? '—'}</dd>
            </div>
          </dl>
          {o.status === 'pending_dispatch' && (
            <Link href="/dispatch" className="mt-4 inline-block text-sm font-medium text-primary">
              Dispatch to shop →
            </Link>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Assign delivery rider</h3>
          <p className="mt-1 text-xs text-slate-500">
            When laundry is <code>ready_for_delivery</code> — status becomes{' '}
            <code>rider_assigned_delivery</code>. Rider is notified in-app.
          </p>

          {o.status === 'ready_for_delivery' && !o.deliveryRiderId && (
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
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800"
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
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Assign pickup rider</h3>
          <p className="mt-1 text-xs text-slate-500">
            After shop assignment — status becomes <code>rider_assigned_pickup</code>. Rider is
            notified in-app and via socket.
          </p>

          {o.status === 'shop_assigned' && !o.pickupRiderId && (
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
                  className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700"
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
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
            className="mt-4 w-full rounded border px-3 py-2 text-sm"
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
            className="mt-2 w-full rounded border px-3 py-2 text-sm"
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
              !(riderId ||
                (assignType === 'delivery'
                  ? data.suggestedDeliveryRiderId
                  : data.suggestedPickupRiderId))
            }
            className="mt-3 w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50"
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
            disabled={busy}
            className="mt-2 w-full rounded-lg border py-2 text-sm text-slate-600"
            onClick={() =>
              run(() =>
                adminFetch(`/admin/operations/orders/${id}/dispatch-pickup`, { method: 'POST' }),
              )
            }
          >
            Broadcast to marketplace (riders accept)
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Conflicts</h3>
        {o.operationsConflict && (
          <p className="mt-2 text-sm text-red-700">{o.operationsConflictNote}</p>
        )}
        <input
          className="mt-3 w-full rounded border px-3 py-2 text-sm"
          placeholder="Conflict note"
          value={conflictNote}
          onChange={(e) => setConflictNote(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !conflictNote}
          className="mt-2 rounded-lg border px-4 py-2 text-sm"
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
          className="mt-4 w-full rounded border px-3 py-2 text-sm"
          placeholder="Resolution note"
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !resolution}
          className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
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
        <Link href="/support" className="mt-3 block text-sm text-primary">
          Open support tickets →
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
