'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isPartnerRole, partnerFetch } from '../../../lib/partner-api';
import { usePartnerPipelineSocket } from '../../../lib/use-partner-pipeline-socket';

interface IncomingOrder {
  _id: string;
  bookingType: string;
  status: string;
  total: number;
  branchName?: string;
  branchId?: string;
  currentStepLabel?: string;
  assignedStaffEmail?: string;
  partnerAcceptedAt?: string;
  canAccept?: boolean;
  canRequestPickup?: boolean;
  canRequestDelivery?: boolean;
  canReceiveAtShop?: boolean;
  receivingStepLabel?: string;
  slaLabel?: string;
}

export default function IncomingOrdersPage() {
  const router = useRouter();
  const [items, setItems] = useState<IncomingOrder[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await partnerFetch<{ items: IncomingOrder[] }>('/partner/orders/incoming');
    setItems(d.items);
  }, []);

  useEffect(() => {
    if (!isPartnerRole()) {
      router.replace('/orders');
      return;
    }
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [router, load]);

  const branchIds = useMemo(
    () => [...new Set(items.map((o) => o.branchId).filter(Boolean))] as string[],
    [items],
  );

  const { connected: socketLive } = usePartnerPipelineSocket(branchIds, {
    onPipelineUpdated: () => {
      load().catch(() => {});
    },
  });

  async function action(orderId: string, path: string) {
    setBusy(orderId + path);
    setError('');
    try {
      await partnerFetch(path, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">Incoming orders</h2>
        {socketLive ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            ● Live
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Orders assigned by Lunara. Accept at the shop, then request pickup or process laundry.
      </p>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-6 space-y-2">
        {items.length === 0 && !error && (
          <p className="text-slate-500">No incoming orders right now.</p>
        )}
        {items.map((o) => (
          <div
            key={o._id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4"
          >
            <Link href={`/orders/${o._id}`} className="min-w-0 flex-1 hover:text-primary">
              <p className="font-medium capitalize">{o.bookingType.replace(/_/g, ' ')}</p>
              <p className="text-sm capitalize text-slate-500">
                {o.status.replace(/_/g, ' ')}
                {o.branchName ? ` · ${o.branchName}` : ''}
              </p>
              {o.receivingStepLabel && (
                <p className="mt-1 text-xs text-amber-600">{o.receivingStepLabel}</p>
              )}
              {o.slaLabel && <p className="mt-1 text-xs text-slate-400">{o.slaLabel}</p>}
              {!o.partnerAcceptedAt && (
                <p className="mt-1 text-xs text-amber-600">Awaiting shop acceptance</p>
              )}
            </Link>
            <div className="flex flex-wrap gap-2">
              {o.canAccept && (
                <button
                  type="button"
                  disabled={!!busy}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white"
                  onClick={() => action(o._id, `/partner/orders/${o._id}/accept`)}
                >
                  Accept order
                </button>
              )}
              {o.canReceiveAtShop && (
                <Link
                  href={`/orders/${o._id}/receiving`}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white"
                >
                  Receive at shop
                </Link>
              )}
              {o.canRequestPickup && (
                <button
                  type="button"
                  disabled={!!busy}
                  className="rounded-lg border border-primary px-3 py-2 text-xs font-medium text-primary"
                  onClick={() => action(o._id, `/partner/orders/${o._id}/request-pickup`)}
                >
                  Request pickup
                </button>
              )}
              {o.canRequestDelivery && (
                <button
                  type="button"
                  disabled={!!busy}
                  className="rounded-lg border px-3 py-2 text-xs font-medium"
                  onClick={() => action(o._id, `/partner/orders/${o._id}/request-delivery`)}
                >
                  Request delivery
                </button>
              )}
              <Link
                href={`/orders/${o._id}`}
                className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-600"
              >
                Open →
              </Link>
            </div>
            <p className="w-full text-right font-medium sm:w-auto">₱{o.total}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
