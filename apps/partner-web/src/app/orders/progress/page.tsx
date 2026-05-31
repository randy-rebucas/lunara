'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageHeader } from '../../../components/ui/page-header';
import { LiveBadge } from '../../../components/ui/card';
import { isPartnerRole, partnerFetch } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';
import { usePartnerPipelineSocket } from '../../../lib/use-partner-pipeline-socket';

interface ProgressOrder {
  _id: string;
  bookingType: string;
  status: string;
  total: number;
  currentStepLabel?: string;
  assignedStaffEmail?: string;
  progress?: number;
  branchId?: string;
}

export default function MonitorProgressPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isPartnerRole()) router.replace('/orders');
  }, [router]);

  const load = useCallback(async () => {
    if (!isPartnerRole()) return [] as ProgressOrder[];
    const d = await partnerFetch<{ items: ProgressOrder[] }>('/partner/orders/progress');
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

  if (!isPartnerRole()) return null;

  return (
    <div>
      <PageHeader
        title="Monitor progress"
        description="Orders currently in the shop pipeline or ready for delivery."
        badge={socketLive ? <LiveBadge /> : undefined}
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading progress…" />
      </div>

      <div className="mt-6 space-y-2">
        {(items ?? []).map((o) => (
          <Link key={o._id} href={`/orders/${o._id}`} className="list-row block">
            <div className="w-full">
              <div className="flex justify-between">
                <p className="font-medium capitalize text-slate-900">{o.bookingType.replace(/_/g, ' ')}</p>
                <p className="font-semibold text-slate-900">₱{o.total}</p>
              </div>
              <p className="mt-1 text-sm capitalize text-muted">
                {o.status.replace(/_/g, ' ')} · {o.currentStepLabel ?? 'Processing'}
              </p>
              {o.assignedStaffEmail && (
                <p className="mt-1 text-xs text-muted">Staff: {o.assignedStaffEmail}</p>
              )}
              {typeof o.progress === 'number' && o.progress > 0 && (
                <p className="mt-1 text-xs text-primary">{o.progress} steps completed</p>
              )}
            </div>
          </Link>
        ))}
        {!loading && !error && (items ?? []).length === 0 && (
          <p className="text-sm text-muted">Nothing in progress.</p>
        )}
      </div>
    </div>
  );
}
