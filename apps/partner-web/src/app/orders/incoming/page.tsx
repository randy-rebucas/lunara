'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '../../../components/ui/page-header';
import { LiveBadge } from '../../../components/ui/card';
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
      <PageHeader
        title="Incoming orders"
        description="Orders assigned by Lunara. Accept at the shop, then request pickup or process laundry."
        badge={socketLive ? <LiveBadge /> : undefined}
      />

      {error && <div className="alert-error">{error}</div>}

      <div className="mt-6 space-y-2">
        {items.length === 0 && !error && (
          <p className="text-sm text-muted">No incoming orders right now.</p>
        )}
        {items.map((o) => (
          <div key={o._id} className="list-row flex-wrap">
            <Link href={`/orders/${o._id}`} className="min-w-0 flex-1">
              <p className="font-medium capitalize text-slate-900">{o.bookingType.replace(/_/g, ' ')}</p>
              <p className="text-sm capitalize text-muted">
                {o.status.replace(/_/g, ' ')}
                {o.branchName ? ` · ${o.branchName}` : ''}
              </p>
              {o.receivingStepLabel && (
                <p className="mt-1 text-xs text-amber-700">{o.receivingStepLabel}</p>
              )}
              {o.slaLabel && <p className="mt-1 text-xs text-muted-foreground">{o.slaLabel}</p>}
              {!o.partnerAcceptedAt && (
                <p className="mt-1 text-xs text-amber-700">Awaiting shop acceptance</p>
              )}
            </Link>
            <div className="flex flex-wrap gap-2">
              {o.canAccept && (
                <button
                  type="button"
                  disabled={!!busy}
                  className="btn-primary btn-sm"
                  onClick={() => action(o._id, `/partner/orders/${o._id}/accept`)}
                >
                  Accept order
                </button>
              )}
              {o.canReceiveAtShop && (
                <Link href={`/orders/${o._id}/receiving`} className="btn-secondary btn-sm">
                  Receive at shop
                </Link>
              )}
              {o.canRequestPickup && (
                <button
                  type="button"
                  disabled={!!busy}
                  className="btn-outline btn-sm text-primary"
                  onClick={() => action(o._id, `/partner/orders/${o._id}/request-pickup`)}
                >
                  Request pickup
                </button>
              )}
              {o.canRequestDelivery && (
                <button
                  type="button"
                  disabled={!!busy}
                  className="btn-outline btn-sm"
                  onClick={() => action(o._id, `/partner/orders/${o._id}/request-delivery`)}
                >
                  Request delivery
                </button>
              )}
              <Link href={`/orders/${o._id}`} className="btn-outline btn-sm">
                Open →
              </Link>
            </div>
            <p className="w-full font-semibold text-slate-900 sm:w-auto sm:text-right">₱{o.total}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
