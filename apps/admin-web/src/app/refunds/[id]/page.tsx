'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { REFUND_FLOW, formatRefundStatus, refundFlowIndex } from '@lunara/utils';
import { DataPageStatus } from '../../../components/data-page-status';
import { adminFetch } from '../../../lib/admin-api';
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
        <Link href="/refunds" className="text-sm text-indigo-600">
          ← Refunds
        </Link>
        <DataPageStatus loading={pageLoading} error={loadError} loadingMessage="Loading refund…" />
      </div>
    );
  }

  const { refund } = data;
  const stageIdx = refundFlowIndex(refund.stage);

  return (
    <div>
      <Link href="/refunds" className="text-sm text-indigo-600">
        ← All refunds
      </Link>
      <h2 className="mt-4 text-2xl font-bold">Refund review</h2>
      <p className="mt-1 text-sm capitalize text-slate-500">{formatRefundStatus(refund.status)}</p>

      <ol className="mt-6 space-y-2">
        {REFUND_FLOW.map((step, i) => {
          const done = i < stageIdx || refund.status === 'closed';
          const active = i === stageIdx;
          return (
            <li
              key={step.id}
              className={`rounded-lg border px-4 py-2 text-sm ${
                active ? 'border-indigo-400 bg-indigo-50' : done ? 'bg-green-50' : 'bg-white'
              }`}
            >
              {done ? '✓ ' : active ? '→ ' : '○ '}
              {step.label}
            </li>
          );
        })}
      </ol>

      <p className="mt-6 rounded-lg border bg-white p-4 text-sm">{refund.reason}</p>
      <p className="mt-2 text-sm font-medium">Requested: ₱{refund.requestedAmount}</p>

      {data.order && (
        <section className="mt-8 rounded-xl border bg-white p-5">
          <h3 className="font-semibold">Verify order</h3>
          <p className="mt-2 text-sm capitalize">
            {data.order.bookingType.replace(/_/g, ' ')} · ₱{data.order.total} ·{' '}
            {data.order.status.replace(/_/g, ' ')}
          </p>
          {data.payment && (
            <p className="mt-2 text-sm text-slate-600">
              Payment: {data.payment.method} · {data.payment.status} · ₱{data.payment.amount}
              {data.payment.receiptCode ? ` · ${data.payment.receiptCode}` : ''}
            </p>
          )}
          {data.verification && (
            <ul className="mt-3 text-sm">
              <li>{data.verification.paymentPaid ? '✓' : '✗'} Payment completed</li>
              <li>{data.verification.paymentMatchesOrder ? '✓' : '✗'} Amount matches order</li>
              <li>{data.verification.eligibleForRefund ? '✓' : '✗'} Eligible for refund</li>
            </ul>
          )}
          <button
            type="button"
            disabled={loading || !!refund.orderVerifiedAt}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={() => review('verify_order')}
          >
            {refund.orderVerifiedAt ? 'Order verified' : 'Mark order verified'}
          </button>
        </section>
      )}

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h3 className="font-semibold">Approve / reject</h3>
        <input
          className="mt-3 w-full rounded border px-3 py-2 text-sm"
          type="number"
          value={approvedAmount}
          onChange={(e) => setApprovedAmount(e.target.value)}
          placeholder="Approved amount"
        />
        <input
          className="mt-3 w-full rounded border px-3 py-2 text-sm"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Rejection reason (if rejecting)"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white"
            onClick={() =>
              review('approve', { approvedAmount: Number(approvedAmount) })
            }
          >
            Approve
          </button>
          <button
            type="button"
            disabled={loading}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700"
            onClick={() => review('reject', { rejectionReason })}
          >
            Reject
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border bg-white p-5">
        <h3 className="font-semibold">Process & notify</h3>
        <textarea
          className="mt-3 w-full rounded border px-3 py-2 text-sm"
          rows={2}
          placeholder="Admin note"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {refund.status === 'pending' && (
            <button
              type="button"
              disabled={loading}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
              onClick={() => review('start_review')}
            >
              Start review
            </button>
          )}
          <button
            type="button"
            disabled={loading || refund.status !== 'approved'}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={() => review('process')}
          >
            Process refund (wallet)
          </button>
          <button
            type="button"
            disabled={loading || !!refund.customerNotifiedAt}
            className="rounded-lg border px-4 py-2 text-sm"
            onClick={() => review('notify')}
          >
            Notify customer
          </button>
        </div>
        {refund.processedAt && (
          <p className="mt-3 text-sm text-green-700">Processed at {new Date(refund.processedAt).toLocaleString()}</p>
        )}
        {refund.customerNotifiedAt && (
          <p className="text-sm text-slate-500">Customer notified</p>
        )}
      </section>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  );
}
