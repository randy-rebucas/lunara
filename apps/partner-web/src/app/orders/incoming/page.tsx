'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PartnerOrderSummary } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { AuthLoading } from '../../../components/auth-loading';
import { PageHeader } from '../../../components/ui/page-header';
import { LiveBadge } from '../../../components/ui/card';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { formatPeso } from '../../../lib/format-peso';
import { partnerOrderHref } from '../../../lib/partner-order-links';
import { isPartnerRole, partnerFetch } from '../../../lib/partner-api';
import { usePartnerPipelineSocket } from '../../../lib/use-partner-pipeline-socket';

export default function IncomingOrdersPage() {
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.ADMIN, UserRole.STAFF] });
  const partner = isPartnerRole();
  const [items, setItems] = useState<PartnerOrderSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await partnerFetch<{ items: PartnerOrderSummary[] }>('/partner/orders/incoming');
    setItems(d.items);
  }, []);

  useEffect(() => {
    if (!ready) return;
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [ready, load]);

  const branchIds = useMemo(
    () => [...new Set(items.map((o) => o.branchId).filter(Boolean))] as string[],
    [items],
  );

  const { connected: socketLive } = usePartnerPipelineSocket(branchIds, {
    onPipelineUpdated: () => {
      load().catch(() => {});
    },
  });

  const needsAction = useMemo(
    () =>
      items.filter(
        (o) => o.canAccept || o.canReceiveAtShop || o.canRequestDelivery || !o.partnerAcceptedAt,
      ).length,
    [items],
  );

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

  if (!ready) return <AuthLoading message="Loading incoming orders…" />;

  return (
    <div>
      <PageHeader
        title="Incoming orders"
        description={
          partner
            ? 'Orders assigned by Lunara. Accept at the shop, receive laundry, then hand off to processing.'
            : 'Orders at your branch — receive laundry and verify intake when riders arrive.'
        }
        badge={socketLive ? <LiveBadge /> : undefined}
        actions={
          <button type="button" className="btn-outline btn-sm" onClick={() => load()}>
            Refresh
          </button>
        }
      />

      {needsAction > 0 && (
        <p className="mt-4 text-sm text-amber-800">
          {needsAction} order{needsAction === 1 ? '' : 's'} need attention (acceptance, receiving, or
          delivery).
        </p>
      )}

      {error && <div className="alert-error mt-4">{error}</div>}

      <div className="mt-6 space-y-2">
        {items.length === 0 && !error && (
          <p className="text-sm text-muted">No incoming orders right now.</p>
        )}
        {items.map((o) => {
          const href = partnerOrderHref(o);
          return (
            <div key={o._id} className="list-row flex-wrap">
              <Link href={href} className="min-w-0 flex-1">
                <p className="font-medium capitalize text-slate-900">{o.bookingType.replace(/_/g, ' ')}</p>
                <p className="text-sm capitalize text-muted">
                  {o.status.replace(/_/g, ' ')}
                  {o.branchName ? ` · ${o.branchName}` : ''}
                </p>
                {o.currentStepLabel && (
                  <p className="mt-1 text-xs text-slate-600">{o.currentStepLabel}</p>
                )}
                {o.receivingStepLabel && (
                  <p className="mt-1 text-xs text-amber-700">{o.receivingStepLabel}</p>
                )}
                {o.slaLabel && <p className="mt-1 text-xs text-muted-foreground">{o.slaLabel}</p>}
                {partner && !o.partnerAcceptedAt && (
                  <p className="mt-1 text-xs text-amber-700">Awaiting shop acceptance</p>
                )}
              </Link>
              <div className="flex flex-wrap gap-2">
                {partner && o.canAccept && (
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
                <Link href={href} className="btn-outline btn-sm">
                  Open →
                </Link>
              </div>
              <p className="w-full font-semibold text-slate-900 sm:w-auto sm:text-right">
                {formatPeso(o.total)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
