'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import type { PartnerOrderSummary } from '@lunara/types';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageHeader } from '../../../components/ui/page-header';
import { LiveBadge } from '../../../components/ui/card';
import { useRequirePartner } from '../../../hooks/use-protected-page';
import { formatPeso } from '../../../lib/format-peso';
import { partnerOrderHref } from '../../../lib/partner-order-links';
import { partnerFetch } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';
import { usePartnerPipelineSocket } from '../../../lib/use-partner-pipeline-socket';

export default function MonitorProgressPage() {
  const { ready } = useRequirePartner();

  const load = useCallback(async () => {
    const d = await partnerFetch<{ items: PartnerOrderSummary[] }>('/partner/orders/progress');
    return d.items;
  }, []);

  const { data: items, loading, error, reload } = usePartnerQuery(load, []);

  const branchIds = useMemo(
    () => [...new Set((items ?? []).map((o) => o.branchId).filter(Boolean))] as string[],
    [items],
  );

  const { connected: socketLive } = usePartnerPipelineSocket(branchIds, {
    onPipelineUpdated: () => {
      void reload();
    },
  });

  const readyCount = useMemo(
    () => (items ?? []).filter((o) => o.status === 'ready_for_delivery').length,
    [items],
  );

  if (!ready) return <AuthLoading message="Loading progress…" />;

  return (
    <div>
      <PageHeader
        title="Monitor progress"
        description="Orders in laundry processing or ready for customer delivery."
        badge={socketLive ? <LiveBadge /> : undefined}
        actions={
          <>
            <button type="button" className="btn-outline btn-sm" onClick={() => reload()}>
              Refresh
            </button>
            <Link href="/orders" className="btn-outline btn-sm">
              Processing queue →
            </Link>
          </>
        }
      />

      {(items ?? []).length > 0 && (
        <p className="mt-4 text-sm text-muted">
          {items!.length} in pipeline
          {readyCount > 0 ? ` · ${readyCount} ready for delivery` : ''}
        </p>
      )}

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading progress…" />
      </div>

      <div className="mt-6 space-y-2">
        {(items ?? []).map((o) => {
          const href = partnerOrderHref(o);
          const isReady = o.status === 'ready_for_delivery';
          return (
            <Link
              key={o._id}
              href={href}
              className={`list-row block ${isReady ? 'ring-emerald-200/80 bg-emerald-50/40' : ''}`}
            >
              <div className="w-full">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium capitalize text-slate-900">
                    {o.bookingType.replace(/_/g, ' ')}
                  </p>
                  <p className="font-semibold text-slate-900">{formatPeso(o.total)}</p>
                </div>
                <p className="mt-1 text-sm capitalize text-muted">
                  {o.status.replace(/_/g, ' ')} · {o.currentStepLabel ?? 'Processing'}
                </p>
                {o.assignedStaffEmail && (
                  <p className="mt-1 text-xs text-muted">Staff: {o.assignedStaffEmail}</p>
                )}
                {isReady && (
                  <p className="mt-1 text-xs font-medium text-emerald-700">Ready for delivery rider</p>
                )}
              </div>
            </Link>
          );
        })}
        {!loading && !error && (items ?? []).length === 0 && (
          <p className="text-sm text-muted">
            Nothing in the processing pipeline. Completed intake orders appear here once laundry
            processing starts.
          </p>
        )}
      </div>
    </div>
  );
}
