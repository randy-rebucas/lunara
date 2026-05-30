'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { partnerFetch } from '../../../../lib/partner-api';

interface ReceivingView {
  order: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
    estimatedWeightKg?: number;
    branchName?: string;
    pickup?: { actualWeightKg?: number; receiptCode?: string };
  };
  shopReceiving?: {
    receivedAt?: string;
    verifiedWeightKg?: number;
    weightVerifiedAt?: string;
    itemCount?: number;
    itemsConfirmedAt?: string;
  };
  workflowSteps: string[];
  workflowStep: number;
  workflowStepLabel?: string;
  canReceive: boolean;
  canVerifyWeight: boolean;
  canConfirmItems: boolean;
  isComplete: boolean;
}

export default function ShopReceivingPage() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<ReceivingView | null>(null);
  const [weight, setWeight] = useState('');
  const [itemCount, setItemCount] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await partnerFetch<ReceivingView>(`/partner/orders/${id}/receiving`);
    setView(data);
    if (data.shopReceiving?.verifiedWeightKg) {
      setWeight(String(data.shopReceiving.verifiedWeightKg));
    } else if (data.order.estimatedWeightKg) {
      setWeight(String(data.order.estimatedWeightKg));
    } else if (data.order.pickup?.actualWeightKg) {
      setWeight(String(data.order.pickup.actualWeightKg));
    }
    if (data.shopReceiving?.itemCount) setItemCount(String(data.shopReceiving.itemCount));
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [load]);

  async function run(path: string, body?: object) {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      await partnerFetch(`/partner/orders/${id}/receiving/${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  if (!view) {
    return error ? <p className="text-red-500">{error}</p> : <p>Loading…</p>;
  }

  const est = view.order.estimatedWeightKg;
  const riderWt = view.order.pickup?.actualWeightKg;

  return (
    <div>
      <Link href="/orders/incoming" className="text-sm text-slate-500 hover:text-primary">
        ← Incoming orders
      </Link>

      <h2 className="mt-4 text-2xl font-bold">Shop receiving</h2>
      <p className="mt-1 text-sm capitalize text-slate-500">
        {view.order.bookingType.replace(/_/g, ' ')} · {view.order.status.replace(/_/g, ' ')}
        {view.order.branchName ? ` · ${view.order.branchName}` : ''}
      </p>

      <ol className="mt-6 space-y-2">
        {view.workflowSteps.map((label, i) => {
          const state =
            i < view.workflowStep ? 'done' : i === view.workflowStep ? 'current' : 'upcoming';
          return (
            <li
              key={label}
              className={`rounded-lg border px-4 py-3 text-sm ${
                state === 'current'
                  ? 'border-primary bg-primary/5 font-medium'
                  : state === 'done'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-400'
              }`}
            >
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>

      {view.order.pickup?.receiptCode && (
        <p className="mt-4 text-sm text-slate-600">
          Pickup receipt: <span className="font-mono font-semibold">{view.order.pickup.receiptCode}</span>
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {view.canReceive && (
        <div className="mt-6 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Receive laundry</h3>
          <p className="mt-1 text-sm text-slate-500">Confirm bags arrived from the rider.</p>
          <input
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            disabled={loading}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            onClick={() => run('receive', { note: note || undefined })}
          >
            Receive laundry
          </button>
        </div>
      )}

      {view.canVerifyWeight && (
        <div className="mt-6 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Verify weight</h3>
          <p className="mt-1 text-sm text-slate-500">
            {est != null && `Customer estimate: ${est} kg`}
            {riderWt != null && ` · Rider weighed: ${riderWt} kg`}
          </p>
          <input
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            type="number"
            step="0.1"
            placeholder="Verified weight (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <button
            type="button"
            disabled={loading || !weight}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            onClick={() =>
              run('verify-weight', { verifiedWeightKg: Number(weight), note: note || undefined })
            }
          >
            Verify weight
          </button>
        </div>
      )}

      {view.canConfirmItems && (
        <div className="mt-6 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Confirm items</h3>
          <p className="mt-1 text-sm text-slate-500">
            Count bags/pieces. Status becomes <span className="font-mono">received_at_shop</span>.
          </p>
          <input
            className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
            type="number"
            min={1}
            value={itemCount}
            onChange={(e) => setItemCount(e.target.value)}
          />
          <button
            type="button"
            disabled={loading}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            onClick={() =>
              run('confirm-items', {
                itemCount: Number(itemCount),
                note: note || undefined,
              })
            }
          >
            Confirm items
          </button>
        </div>
      )}

      {view.isComplete && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-800">Received at shop</p>
          <p className="mt-1 text-sm text-emerald-700">
            {view.shopReceiving?.verifiedWeightKg != null &&
              `Verified ${view.shopReceiving.verifiedWeightKg} kg`}
            {view.shopReceiving?.itemCount != null && ` · ${view.shopReceiving.itemCount} item(s)`}
          </p>
          <Link
            href={`/orders/${id}`}
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Start laundry processing →
          </Link>
        </div>
      )}
    </div>
  );
}
