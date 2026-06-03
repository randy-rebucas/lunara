'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { REFUND_FLOW, formatRefundStatus, refundFlowIndex } from '@lunara/utils';
import { DataPageStatus } from '../../../components/data-page-status';
import { Card, CardBody } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { adminFetch } from '../../../lib/admin-api';
import { formatSlugLabel } from '../../../lib/format-label';
import { formatPeso } from '../../../lib/format-peso';
import { useAdminQuery } from '../../../lib/use-admin-query';

interface RefundReview {
  refund: {
    _id: string;
    orderId: string;
    reason: string;
    status: string;
    stage: string;
    requestedAmount: number;
    approvedAmount?: number;
    rejectionReason?: string;
    orderVerifiedAt?: string;
    processedAt?: string;
    customerNotifiedAt?: string;
  };
  order: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
    statusHistory?: { status: string; timestamp: string; note?: string }[];
  } | null;
  payment: {
    method: string;
    status: string;
    amount: number;
    receiptCode?: string;
    paidAt?: string;
  } | null;
  verification: {
    paymentPaid: boolean;
    paymentMatchesOrder: boolean;
    eligibleForRefund: boolean;
  } | null;
}

export default function AdminRefundReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [adminNote, setAdminNote] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) throw new Error('Refund not found');
    const d = await adminFetch<RefundReview>(`/admin/refunds/${id}`);
    setApprovedAmount(String(d.refund.approvedAmount ?? d.refund.requestedAmount));
    return d;
  }, [id]);

  const { data, loading: pageLoading, error: loadError, reload } = useAdminQuery(load, [id]);

  async function review(action: string, body?: Record<string, unknown>) {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      await adminFetch(`/admin/refunds/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, adminNote: adminNote || undefined, ...body }),
      });
      setAdminNote('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading || loadError || !data) {
    return (
      <div>
        <PageHeader title="Refund review" backHref="/refunds" backLabel="Refunds" />
        <DataPageStatus loading={pageLoading} error={loadError} loadingMessage="Loading refund…" />
      </div>
    );
  }

  const { refund } = data;
  const stageIdx = refundFlowIndex(refund.stage);

  return (
    <div>
      <PageHeader
        title="Refund review"
        description={`Order …${refund.orderId.slice(-6)} · ${formatRefundStatus(refund.status)}`}
        backHref="/refunds"
        backLabel="Refunds"
      />

      {error ? (
        <div className="alert-error mb-4" role="alert">
          {error}
        </div>
      ) : null}

      <ol className="space-y-2">
        {REFUND_FLOW.map((step, i) => {
          const done = i < stageIdx || refund.status === 'closed';
          const active = i === stageIdx;
          return (
            <li
              key={step.id}
              className={`rounded-lg border px-4 py-2.5 text-sm ${
                active
                  ? 'border-primary/40 bg-primary/5 font-medium text-primary'
                  : done
                    ? 'border-emerald-200/80 bg-emerald-50/50 text-emerald-900'
                    : 'border-border/60 bg-surface text-muted'
              }`}
            >
              {done ? '✓ ' : active ? '→ ' : '○ '}
              {step.label}
            </li>
          );
        })}
      </ol>

      <Card className="mt-6">
        <CardBody>
          <p className="text-sm text-slate-700">{refund.reason}</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            Requested: {formatPeso(refund.requestedAmount)}
          </p>
        </CardBody>
      </Card>

      {data.order && (
        <Card className="mt-6">
          <CardBody>
            <h3 className="font-semibold text-slate-900">Verify order</h3>
            <p className="mt-2 text-sm capitalize text-muted">
              {formatSlugLabel(data.order.bookingType)} · {formatPeso(data.order.total)} ·{' '}
              {formatSlugLabel(data.order.status)}
            </p>
            {data.payment && (
              <p className="mt-2 text-sm text-muted">
                Payment: {data.payment.method} · {data.payment.status} ·{' '}
                {formatPeso(data.payment.amount)}
                {data.payment.receiptCode ? ` · ${data.payment.receiptCode}` : ''}
              </p>
            )}
            {data.verification && (
              <ul className="mt-3 space-y-1 text-sm">
                <li>{data.verification.paymentPaid ? '✓' : '✗'} Payment completed</li>
                <li>{data.verification.paymentMatchesOrder ? '✓' : '✗'} Amount matches order</li>
                <li>{data.verification.eligibleForRefund ? '✓' : '✗'} Eligible for refund</li>
              </ul>
            )}
            <button
              type="button"
              disabled={loading || !!refund.orderVerifiedAt}
              className="btn-primary btn-sm mt-4 disabled:opacity-50"
              onClick={() => review('verify_order')}
            >
              {refund.orderVerifiedAt ? 'Order verified' : 'Mark order verified'}
            </button>
          </CardBody>
        </Card>
      )}

      <Card className="mt-6">
        <CardBody>
          <h3 className="font-semibold text-slate-900">Approve / reject</h3>
          <label htmlFor="approved-amount" className="form-label mt-4">
            Approved amount
          </label>
          <input
            id="approved-amount"
            className="input-field"
            type="number"
            value={approvedAmount}
            onChange={(e) => setApprovedAmount(e.target.value)}
          />
          <label htmlFor="rejection-reason" className="form-label mt-3">
            Rejection reason
          </label>
          <input
            id="rejection-reason"
            className="input-field"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Required if rejecting"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              className="btn-primary btn-sm"
              onClick={() => review('approve', { approvedAmount: Number(approvedAmount) })}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={loading}
              className="btn-outline btn-sm text-destructive"
              onClick={() => review('reject', { rejectionReason })}
            >
              Reject
            </button>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardBody>
          <h3 className="font-semibold text-slate-900">Process & notify</h3>
          <label htmlFor="admin-note" className="form-label mt-3">
            Admin note
          </label>
          <textarea
            id="admin-note"
            className="input-field min-h-20"
            rows={2}
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {refund.status === 'pending' && (
              <button
                type="button"
                disabled={loading}
                className="btn-secondary btn-sm"
                onClick={() => review('start_review')}
              >
                Start review
              </button>
            )}
            <button
              type="button"
              disabled={loading || refund.status !== 'approved'}
              className="btn-primary btn-sm disabled:opacity-50"
              onClick={() => review('process')}
            >
              Process refund (wallet)
            </button>
            <button
              type="button"
              disabled={loading || !!refund.customerNotifiedAt}
              className="btn-outline btn-sm disabled:opacity-50"
              onClick={() => review('notify')}
            >
              Notify customer
            </button>
          </div>
          {refund.processedAt && (
            <p className="mt-3 text-sm text-emerald-700">
              Processed {new Date(refund.processedAt).toLocaleString()}
            </p>
          )}
          {refund.customerNotifiedAt && (
            <p className="text-sm text-muted">Customer notified</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
