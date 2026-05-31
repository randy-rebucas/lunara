'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { REFUND_FLOW, formatRefundStatus, refundFlowIndex } from '@lunara/utils';
import { ButtonLink } from '../../../components/ui/button-link';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { PageShell } from '../../../components/page-shell';
import { DataPageStatus } from '../../../components/data-page-status';
import { useCustomerQuery } from '../../../lib/use-customer-query';

interface RefundDetail {
  _id: string;
  orderId: string;
  reason: string;
  status: string;
  stage: string;
  requestedAmount: number;
  approvedAmount?: number;
  rejectionReason?: string;
  processedAt?: string;
  customerNotifiedAt?: string;
  timeline?: { stage: string; label: string; at: string; note?: string }[];
}

export default function RefundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useAuthContext();

  const load = useCallback(async () => {
    if (!id) throw new Error('Refund not found');
    const res = await api.get<{ refund: RefundDetail }>(`/refunds/${id}`);
    return res.data.refund;
  }, [api, id]);

  const { data: refund, loading, error } = useCustomerQuery(load, [api, id]);

  if (loading || error || !refund) {
    return (
      <PageShell narrow>
        <Link href="/refunds" className="text-sm text-muted transition-colors hover:text-primary">
          ← All refunds
        </Link>
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading refund…" />
      </PageShell>
    );
  }

  const stageIdx = refundFlowIndex(refund.stage);

  return (
    <PageShell narrow>
      <Link href="/refunds" className="text-sm text-muted transition-colors hover:text-primary">
        ← All refunds
      </Link>
        <h1 className="mt-4 text-2xl font-bold">Refund request</h1>
        <p className="mt-1 text-sm capitalize text-slate-500">
          {formatRefundStatus(refund.status)}
        </p>

        <ol className="mt-8 list-stack">
          {REFUND_FLOW.map((step, i) => {
            const done = i < stageIdx || refund.status === 'closed';
            const active = i === stageIdx && refund.status !== 'closed';
            return (
              <li
                key={step.id}
                className={`rounded-lg px-4 py-3 text-sm ring-1 ${
                  active ? 'ring-2 ring-primary/30 bg-primary/5' : done ? 'bg-accent/5 ring-accent/20' : 'bg-surface ring-border/40'
                }`}
              >
                {done ? '✓ ' : active ? '→ ' : '○ '}
                {step.label}
              </li>
            );
          })}
        </ol>

        <div className="panel mt-6 text-sm">
          <p className="font-medium">Your request</p>
          <p className="mt-2 text-slate-700">{refund.reason}</p>
          <p className="mt-2 text-slate-500">Requested: ₱{refund.requestedAmount}</p>
          {refund.approvedAmount != null && (
            <p className="text-accent">Approved: ₱{refund.approvedAmount}</p>
          )}
          {refund.rejectionReason && (
            <p className="mt-2 text-red-600">{refund.rejectionReason}</p>
          )}
          {refund.processedAt && (
            <p className="mt-2 text-green-700">Refund credited to your wallet.</p>
          )}
        </div>

        {refund.timeline && refund.timeline.length > 0 && (
          <ul className="mt-6 list-stack-sm text-sm text-slate-600">
            {refund.timeline.map((e, i) => (
              <li key={i}>
                {new Date(e.at).toLocaleString()} — {e.label}
                {e.note ? `: ${e.note}` : ''}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 btn-row">
          <ButtonLink href={`/orders/${refund.orderId}`} variant="outline">
            View order
          </ButtonLink>
          <ButtonLink href="/wallet" variant="ghost">
            Wallet
          </ButtonLink>
        </div>
    </PageShell>
  );
}
