'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { LAUNDRY_PROCESSING_STEPS } from '@lunara/utils';
import { DataPageStatus } from '../../components/data-page-status';
import { partnerFetch } from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

interface QueueOrder {
  _id: string;
  status: string;
  bookingType: string;
  total: number;
  currentStepLabel: string;
  progress: number;
  assignedStaffId?: string;
  isAssigned?: boolean;
}

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
  const [mineOnly, setMineOnly] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadQueue = useCallback(async () => {
    const query = mineOnly ? '?mine=true' : '';
    return partnerFetch<{ items: QueueOrder[]; counts: Record<string, number> }>(
      `/partner/orders/queue${query}`,
    );
  }, [mineOnly]);

  const { data, loading, error, reload } = usePartnerQuery(loadQueue, [mineOnly]);
  const orders = data?.items ?? [];
  const counts = data?.counts ?? {};

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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Processing queue</h2>
          <p className="mt-1 text-sm text-slate-500">{STAFF_JOURNEY.join(' → ')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded px-4 py-2 text-sm ${mineOnly ? 'bg-primary text-white' : 'border bg-white'}`}
            onClick={() => setMineOnly((m) => !m)}
          >
            {mineOnly ? 'My jobs' : 'All jobs'}
          </button>
          <button
            type="button"
            className="rounded bg-primary px-4 py-2 text-sm text-white"
            onClick={() => reload()}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading queue…" />
      </div>
      {actionError && <p className="mt-2 text-sm text-red-500">{actionError}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LAUNDRY_PROCESSING_STEPS.filter((s) => s.orderStatus).map((step) => (
          <div key={step.id} className="rounded-lg border bg-white p-3">
            <p className="text-xs capitalize text-slate-500">{step.orderStatus!.replace(/_/g, ' ')}</p>
            <p className="text-xl font-semibold">{counts[step.orderStatus!] ?? 0}</p>
          </div>
        ))}
        <div className="rounded-lg border bg-amber-50 p-3">
          <p className="text-xs text-slate-500">Awaiting intake</p>
          <p className="text-xl font-semibold">{counts.picked_up ?? 0}</p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {orders.length === 0 ? (
          <p className="text-slate-500">No orders in the processing queue.</p>
        ) : (
          orders.map((o) => (
            <div
              key={o._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4"
            >
              <Link href={`/orders/${o._id}`} className="min-w-0 flex-1 hover:text-primary">
                <p className="font-medium capitalize">{o.bookingType.replace(/_/g, ' ')}</p>
                <p className="text-sm capitalize text-slate-500">
                  {o.status.replace(/_/g, ' ')} · {o.currentStepLabel}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {o.isAssigned ? 'Assigned' : 'Open — accept to start'}
                </p>
              </Link>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-primary">{o.progress}%</p>
                </div>
                {!o.isAssigned && (
                  <button
                    type="button"
                    className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white"
                    onClick={(e) => acceptJob(o._id, e)}
                  >
                    Accept job
                  </button>
                )}
                <Link
                  href={`/orders/${o._id}`}
                  className="rounded-lg border border-primary px-3 py-2 text-xs font-medium text-primary"
                >
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
