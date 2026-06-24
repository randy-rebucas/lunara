'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PartnerQueueOrder } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { DataPageStatus } from '../../components/data-page-status';
import { PageHeader } from '../../components/ui/page-header';
import { LiveBadge } from '../../components/ui/card';
import { ProcessingKanbanBoard } from '../../components/processing-kanban-board';
import { useProtectedPage } from '../../hooks/use-protected-page';
import { getPortalUser, partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';
import { usePartnerPipelineSocket } from '../../lib/use-partner-pipeline-socket';

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
        description="Manage and track active laundry jobs across all processing stages."
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

      <div className="mt-6">
        {orders.length === 0 ? (
          <p className="text-sm text-muted">No orders in the processing queue.</p>
        ) : (
          <ProcessingKanbanBoard orders={orders} onAcceptJob={acceptJob} onReload={reload} />
        )}
      </div>
    </div>
  );
}
