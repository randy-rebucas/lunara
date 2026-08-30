'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { ArrowRight, Check, Circle } from 'lucide-react';
import { REFUND_FLOW, formatCurrency, formatRefundStatus, refundFlowIndex } from '@lunara/utils';
import { formatRefundDate, refundStatusBadgeClass } from '../../../../lib/refunds';
import { ButtonLink } from '../../../../components/ui/button-link';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../../components/auth-loading';
import { PageShell } from '../../../../components/page-shell';
import { DataPageStatus } from '../../../../components/data-page-status';
import { PageHeader } from '../../../../components/ui/page-header';
import { useProtectedPage } from '../../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../../lib/use-customer-query';

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
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });

  const load = useCallback(async () => {
    if (!id) throw new Error('Refund not found');
    const res = await api.get<{ refund: RefundDetail }>(`/refunds/${id}`);
    return res.data.refund;
  }, [api, id]);

  const { data: refund, loading, error } = useCustomerQuery(load, [ready, api, id]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading refund…" />;
  }

  if (loading || error || !refund) {
    return (
      <PageShell narrow>
        <PageHeader title="Refund request" backHref="/refunds" backLabel="Refunds" />
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading refund…" />
      </PageShell>
    );
  }

  const stageIdx = refundFlowIndex(refund.stage);

  return (
    <PageShell narrow>
      <PageHeader
        title="Refund request"
        description={`Order …${refund.orderId.slice(-6)}${refund.processedAt ? ` · Processed ${formatRefundDate(refund.processedAt)}` : ''}`}
        backHref="/refunds"
        backLabel="Refunds"
      />
        <span className={`inline-flex capitalize ${refundStatusBadgeClass(refund.status)}`}>
          {formatRefundStatus(refund.status)}
        </span>

        <ol className="mt-8 list-stack">
          {REFUND_FLOW.map((step, i) => {
            const done = i < stageIdx || refund.status === 'closed';
            const active = i === stageIdx && refund.status !== 'closed';
            return (
              <li
                key={step.id}
                className={`flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm ring-1 ${
                  active ? 'ring-2 ring-primary/30 bg-primary/5' : done ? 'bg-accent/5 ring-accent/20' : 'bg-surface ring-border/40'
                }`}
              >
                {done ? (
                  <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                ) : active ? (
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                )}
                {step.label}
              </li>
            );
          })}
        </ol>

        <div className="panel mt-6 text-sm">
          <p className="font-medium">Your request</p>
          <p className="mt-2 text-slate-700">{refund.reason}</p>
          <p className="mt-2 text-slate-500">Requested: {formatCurrency(refund.requestedAmount)}</p>
          {refund.approvedAmount != null && (
            <p className="text-accent">Approved: {formatCurrency(refund.approvedAmount)}</p>
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
