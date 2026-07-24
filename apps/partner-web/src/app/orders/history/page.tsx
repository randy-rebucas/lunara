'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageHeader } from '../../../components/ui/page-header';
import { useRequirePartner } from '../../../hooks/use-protected-page';
import { partnerFetch } from '../../../lib/partner-api';
import { usePartnerQuery } from '../../../lib/use-partner-query';

interface HistoryOrder {
  _id: string;
  orderNumber?: string;
  customerName?: string;
  status: string;
  totalAmount?: number;
  paymentMethod?: string;
  createdAt: string;
  completedAt?: string;
}

const STATUS_LABELS: Record<string, string> = {
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  customer_pickup: 'Picked up',
};

const STATUS_BADGE: Record<string, string> = {
  delivered: 'badge-success',
  completed: 'badge-success',
  customer_pickup: 'badge-success',
  cancelled: 'badge-error',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAmount(amount?: number) {
  if (amount == null) return '—';
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

const STATUSES = ['delivered', 'completed', 'customer_pickup', 'cancelled'];

function OrderHistoryContent() {
  const { ready } = useRequirePartner();
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customer') ?? undefined;
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (customerId) params.set('customerId', customerId);
    const qs = params.toString();
    return partnerFetch<HistoryOrder[]>(`/partner/orders/history${qs ? `?${qs}` : ''}`);
  }, [statusFilter, customerId]);

  const { data: orders, loading, error } = usePartnerQuery(load, [statusFilter, customerId]);

  if (!ready) return <AuthLoading message="Loading order history…" />;

  return (
    <div>
      <PageHeader
        title="Order history"
        description={
          customerId
            ? 'Completed, delivered, and cancelled orders for this customer.'
            : 'Completed, delivered, and cancelled orders'
        }
      />

      {/* Status filter */}
      <div className="mt-6 flex flex-wrap gap-2">
        {['all', ...STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s === 'all' ? 'All' : (STATUS_LABELS[s] ?? s)}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading orders…" />
      </div>

      {!loading && !error && (orders ?? []).length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-semibold text-slate-900">No orders found</p>
          <p className="mt-1 text-sm text-muted">
            {statusFilter === 'all'
              ? 'Completed and cancelled orders will appear here.'
              : `No ${STATUS_LABELS[statusFilter] ?? statusFilter} orders yet.`}
          </p>
        </div>
      )}

      <div className="section-panel mt-6 overflow-hidden">
        {(orders ?? []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((order) => (
                  <tr key={order._id}>
                    <td>
                      <Link
                        href={`/orders/${order._id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.orderNumber ?? order._id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="text-muted">{order.customerName ?? '—'}</td>
                    <td>
                      <span className={STATUS_BADGE[order.status] ?? 'badge-neutral'}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="font-medium">{formatAmount(order.totalAmount)}</td>
                    <td className="capitalize text-muted">
                      {order.paymentMethod?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="text-muted">
                      {formatDate(order.completedAt ?? order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrderHistoryPage() {
  return (
    <Suspense fallback={<AuthLoading message="Loading order history…" />}>
      <OrderHistoryContent />
    </Suspense>
  );
}
