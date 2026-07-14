'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PartnerOrderSummary } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { isPartnerLaundryProcessingStatus } from '@lunara/utils';
import { AuthLoading } from '../../../components/auth-loading';
import { PageHeader } from '../../../components/ui/page-header';
import { LiveBadge } from '../../../components/ui/card';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { formatPeso } from '../../../lib/format-peso';
import { getPortalUser, isPartnerRole, partnerFetch } from '../../../lib/partner-api';
import { usePartnerPipelineSocket } from '../../../lib/use-partner-pipeline-socket';

type Stage = 'accept' | 'receive' | 'process' | 'deliver';

const STAGE_COLUMNS: { stage: Stage; title: string; hint: string }[] = [
  { stage: 'accept', title: '1. Accept', hint: 'New orders assigned by Lunara' },
  { stage: 'receive', title: '2. Receive & verify', hint: 'Laundry en route or arriving at the shop' },
  { stage: 'process', title: '3. Process', hint: 'Sorting through quality check' },
  { stage: 'deliver', title: '4. Request delivery', hint: 'Ready to go back to the customer' },
];

function stageOf(order: PartnerOrderSummary): Stage {
  if (order.canAccept) return 'accept';
  if (order.status === 'ready_for_delivery') return 'deliver';
  if (isPartnerLaundryProcessingStatus(order.status)) return 'process';
  return 'receive';
}

function OrderCard({
  order,
  stage,
  busy,
  onAction,
}: {
  order: PartnerOrderSummary;
  stage: Stage;
  busy: boolean;
  onAction: (orderId: string, path: string) => void;
}) {
  const portalUser = getPortalUser();
  const jobAccepted = !!order.assignedStaffId;
  const jobIsMine =
    portalUser?.role !== UserRole.STAFF ||
    !order.assignedStaffEmail ||
    order.assignedStaffEmail === portalUser.email;

  return (
    <div className="card p-3">
      <Link href={`/orders/${order._id}`} className="block hover:text-primary">
        <p className="font-medium capitalize text-slate-900">{order.bookingType.replace(/_/g, ' ')}</p>
        <p className="mt-1 text-sm font-semibold text-primary">{formatPeso(order.total)}</p>
        {order.currentStepLabel && (
          <p className="mt-1 text-xs text-muted">{order.currentStepLabel}</p>
        )}
        {order.receivingStepLabel && stage === 'receive' && (
          <p className="mt-1 text-xs text-amber-700">{order.receivingStepLabel}</p>
        )}
        {order.slaLabel && <p className="mt-1 text-xs text-muted-foreground">{order.slaLabel}</p>}
      </Link>

      <div className="mt-2 flex flex-wrap gap-2">
        {stage === 'accept' && (
          <button
            type="button"
            disabled={busy}
            className="btn-primary btn-sm flex-1"
            onClick={() => onAction(order._id, `/partner/orders/${order._id}/accept`)}
          >
            Accept order
          </button>
        )}

        {stage === 'receive' && (
          <Link href={`/orders/${order._id}/receiving`} className="btn-secondary btn-sm flex-1 text-center">
            {order.canReceiveAtShop ? 'Receive at shop' : 'Continue receiving'}
          </Link>
        )}

        {stage === 'process' && !jobAccepted && (
          <button
            type="button"
            disabled={busy}
            className="btn-accent btn-sm flex-1"
            onClick={() => onAction(order._id, `/partner/orders/${order._id}/processing/accept`)}
          >
            Accept job
          </button>
        )}
        {stage === 'process' && jobAccepted && (
          <button
            type="button"
            disabled={busy || !jobIsMine}
            title={jobIsMine ? undefined : `Assigned to ${order.assignedStaffEmail ?? 'another staff member'}`}
            className="btn-primary btn-sm flex-1"
            onClick={() => onAction(order._id, `/partner/orders/${order._id}/processing/advance`)}
          >
            Advance stage
          </button>
        )}

        {stage === 'deliver' && order.canRequestDelivery && (
          <button
            type="button"
            disabled={busy}
            className="btn-outline btn-sm flex-1"
            onClick={() => onAction(order._id, `/partner/orders/${order._id}/request-delivery`)}
          >
            Request delivery
          </button>
        )}

        <Link href={`/orders/${order._id}`} className="btn-outline btn-sm">
          Open
        </Link>
      </div>
    </div>
  );
}

export default function StaffBoardPage() {
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN] });
  const partner = isPartnerRole();
  const [items, setItems] = useState<PartnerOrderSummary[]>([]);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

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

  async function action(orderId: string, path: string) {
    const key = orderId + path;
    setBusyKey(key);
    setError('');
    try {
      await partnerFetch(path, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyKey(null);
    }
  }

  if (!ready) return <AuthLoading message="Loading board…" />;

  const columns = STAGE_COLUMNS.map((col) => ({
    ...col,
    orders: items.filter((o) => stageOf(o) === col.stage),
  }));

  return (
    <div>
      <PageHeader
        title="Staff board"
        description={
          partner
            ? 'Move orders through accept, receive, process, and delivery in one place.'
            : 'Everything you need to move an order from acceptance to delivery.'
        }
        badge={socketLive ? <LiveBadge /> : undefined}
        actions={
          <button type="button" className="btn-outline btn-sm" onClick={() => load()}>
            Refresh
          </button>
        }
      />

      {error && <div className="alert-error mt-4">{error}</div>}

      <div className="mt-6 flex gap-3 overflow-x-auto overscroll-x-contain pb-2 pb-safe">
        {columns.map((col) => (
          <div
            key={col.stage}
            className="flex w-72 shrink-0 flex-col rounded-lg border border-border/60 bg-surface-muted"
          >
            <div className="border-b border-border/60 px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">{col.title}</p>
              <p className="text-xs text-muted">{col.hint}</p>
              <p className="mt-1 text-xs font-medium text-slate-600">
                {col.orders.length} order{col.orders.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex-1 space-y-2 p-2" style={{ minHeight: '4rem' }}>
              {col.orders.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted">Nothing here right now.</p>
              ) : (
                col.orders.map((o) => (
                  <OrderCard
                    key={o._id}
                    order={o}
                    stage={col.stage}
                    busy={busyKey !== null}
                    onAction={action}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
