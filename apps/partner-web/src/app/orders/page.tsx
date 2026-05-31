'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { PartnerQueueOrder } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { LAUNDRY_PROCESSING_STEPS } from '@lunara/utils';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { LiveBadge } from '../../components/ui/card';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { getPortalUser, partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';
import { usePartnerPipelineSocket } from '../../lib/use-partner-pipeline-socket';

const STAFF_JOURNEY = [
  'Login',
  'View queue',
  'Accept job',
  'Update status',
  'Upload photos',
  'Mark stage complete',
  'Forward to next stage',
];

export default function StaffOrdersPage() {
  const { ready } = useProtectedPage({ roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN] });
  const [mineOnly, setMineOnly] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadQueue = useCallback(async () => {
    const query = mineOnly ? '?mine=true' : '';
    return partnerFetch<{ items: PartnerQueueOrder[]; counts: Record<string, number> }>(
      `/partner/orders/queue${query}`,
    );
  }, [mineOnly]);

  const { data, loading, error, reload } = usePartnerQuery(loadQueue, [mineOnly]);
  const orders = data?.items ?? [];
  const counts = data?.counts ?? {};

  const branchIds = useMemo(() => {
    const user = getPortalUser();
    if (user?.branchId) return [user.branchId];
    return [...new Set((data?.items ?? []).map((o) => o.branchId).filter(Boolean))] as string[];
  }, [data?.items]);

  const { connected: socketLive } = usePartnerPipelineSocket(branchIds, {
    onPipelineUpdated: () => {
      void reload();
    },
  });

  async function acceptJob(orderId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setActionError('');
    try {
      await partnerFetch(`/partner/orders/${orderId}/processing/accept`, { method: 'POST' });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not accept job');
    }
  }

  if (!ready) return <AuthLoading message="Loading queue…" />;

  return (
    <div>
      <PageHeader
        title="Processing queue"
        description={STAFF_JOURNEY.join(' → ')}
        badge={socketLive ? <LiveBadge /> : undefined}
        actions={
          <>
            <button
              type="button"
              className={mineOnly ? 'filter-chip-active' : 'filter-chip'}
              onClick={() => setMineOnly((m) => !m)}
            >
              {mineOnly ? 'My jobs' : 'All jobs'}
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={() => reload()}>
              Refresh
            </button>
          </>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading queue…" />
      </div>
      {actionError && <div className="alert-error mt-2">{actionError}</div>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LAUNDRY_PROCESSING_STEPS.filter((s) => s.orderStatus).map((step) => (
          <div key={step.id} className="stat-card !p-3">
            <p className="text-xs capitalize text-muted">{step.orderStatus!.replace(/_/g, ' ')}</p>
            <p className="text-xl font-semibold text-slate-900">{counts[step.orderStatus!] ?? 0}</p>
          </div>
        ))}
        <div className="stat-card-warning !p-3">
          <p className="text-xs text-muted">Awaiting intake</p>
          <p className="text-xl font-semibold text-slate-900">{counts.picked_up ?? 0}</p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {orders.length === 0 ? (
          <p className="text-sm text-muted">No orders in the processing queue.</p>
        ) : (
          orders.map((o) => (
            <div key={o._id} className="list-row flex-wrap">
              <Link href={`/orders/${o._id}`} className="min-w-0 flex-1 hover:text-primary">
                <p className="font-medium capitalize text-slate-900">{o.bookingType.replace(/_/g, ' ')}</p>
                <p className="text-sm capitalize text-muted">
                  {o.status.replace(/_/g, ' ')} · {o.currentStepLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.isAssigned ? 'Assigned' : 'Open — accept to start'}
                </p>
              </Link>
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-primary">{o.progress}%</p>
                {!o.isAssigned && (
                  <button
                    type="button"
                    className="btn-accent btn-sm"
                    onClick={(e) => acceptJob(o._id, e)}
                  >
                    Accept job
                  </button>
                )}
                <Link href={`/orders/${o._id}`} className="btn-outline btn-sm text-primary ring-primary/30">
                  Process →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
