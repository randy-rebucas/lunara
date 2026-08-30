'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import type { PartnerOrderDetailView } from '../../../lib/order-processing-phase';
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

function OrderDetailPanel({ order, onClose }: { order: HistoryOrder; onClose: () => void }) {
  const [detail, setDetail] = useState<PartnerOrderDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);
    setDetailError('');
    partnerFetch<PartnerOrderDetailView>(`/partner/orders/${order._id}/processing`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setDetailError(e instanceof Error ? e.message : 'Failed to load order');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order._id]);

  const detailOrder = detail?.order;

  return (
    <div className="section-panel lg:sticky lg:top-4">
      <div className="section-panel-header flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {order.orderNumber ?? order._id.slice(-6).toUpperCase()}
          </h3>
          <p className="mt-0.5 text-xs text-muted">Order details</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>
      <div className="card-body space-y-4 pt-4">
        <div>
          <span className={STATUS_BADGE[order.status] ?? 'badge-neutral'}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <dt className="text-muted">Customer</dt>
            <dd className="font-medium text-slate-900">{order.customerName ?? '—'}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <dt className="text-muted">Payment</dt>
            <dd className="capitalize text-slate-900">
              {order.paymentMethod?.replace(/_/g, ' ') ?? '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <dt className="text-muted">Created</dt>
            <dd className="text-slate-900">{formatDate(order.createdAt)}</dd>
          </div>
          {order.completedAt && (
            <div className="flex items-center justify-between">
              <dt className="text-muted">Completed</dt>
              <dd className="text-slate-900">{formatDate(order.completedAt)}</dd>
            </div>
          )}
        </dl>

        {detailLoading && <p className="text-sm text-muted">Loading order breakdown…</p>}
        {detailError && <p className="text-sm text-red-500">{detailError}</p>}

        {detailOrder && (
          <div className="border-t border-border/60 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Order breakdown
            </p>
            <div className="mt-2 space-y-1.5 text-sm">
              {detailOrder.items?.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-slate-600">
                  <span className="capitalize">
                    {item.notes?.startsWith('Add-on:')
                      ? item.notes.replace(/^Add-on:\s*/, '')
                      : item.serviceType.replace(/_/g, ' ')}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                  </span>
                  <span>₱{(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              {detailOrder.subtotal !== undefined && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>₱{detailOrder.subtotal.toFixed(2)}</span>
                </div>
              )}
              {!!detailOrder.deliveryFee && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Delivery fee</span>
                  <span>₱{detailOrder.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              {!!detailOrder.discount && (
                <div className="flex items-center justify-between text-accent">
                  <span>Discount{detailOrder.couponCode ? ` (${detailOrder.couponCode})` : ''}</span>
                  <span>-₱{detailOrder.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border/60 pt-1.5 font-semibold text-slate-900">
                <span>Total</span>
                <span>₱{detailOrder.total}</span>
              </div>
            </div>

            {(detailOrder.scheduledPickupAt ||
              detailOrder.scheduledDeliveryAt ||
              detailOrder.estimatedWeightKg !== undefined) && (
              <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-sm text-slate-600">
                {detailOrder.scheduledPickupAt && (
                  <div className="flex items-center justify-between">
                    <span>Scheduled pickup</span>
                    <span className="text-slate-900">
                      {new Date(detailOrder.scheduledPickupAt).toLocaleString('en-PH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                )}
                {detailOrder.scheduledDeliveryAt && (
                  <div className="flex items-center justify-between">
                    <span>Scheduled delivery</span>
                    <span className="text-slate-900">
                      {new Date(detailOrder.scheduledDeliveryAt).toLocaleString('en-PH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                )}
                {detailOrder.estimatedWeightKg !== undefined && (
                  <div className="flex items-center justify-between">
                    <span>Estimated weight</span>
                    <span className="text-slate-900">{detailOrder.estimatedWeightKg} kg</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderHistoryContent() {
  const { ready } = useRequirePartner();
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customer') ?? undefined;
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

      <div
        className={`mt-6 grid gap-4 ${
          selectedId ? 'lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start' : ''
        }`}
      >
        <div className="section-panel overflow-hidden">
          {(orders ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    {!selectedId && <th>Customer</th>}
                    <th>Status</th>
                    <th>Amount</th>
                    {!selectedId && <th>Payment</th>}
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders ?? []).map((order) => (
                    <tr
                      key={order._id}
                      onClick={() => setSelectedId(order._id)}
                      className={`cursor-pointer origin-left transition-[transform,background-color] duration-150 ease-out hover:bg-slate-50 ${
                        selectedId === order._id ? 'scale-[1.015] bg-primary/5' : ''
                      }`}
                    >
                      <td>
                        <span className="font-medium text-primary">
                          {order.orderNumber ?? order._id.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      {!selectedId && <td className="text-muted">{order.customerName ?? '—'}</td>}
                      <td>
                        <span className={STATUS_BADGE[order.status] ?? 'badge-neutral'}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="font-medium">{formatAmount(order.totalAmount)}</td>
                      {!selectedId && (
                        <td className="capitalize text-muted">
                          {order.paymentMethod?.replace(/_/g, ' ') ?? '—'}
                        </td>
                      )}
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

        {selectedId && (
          <OrderDetailPanel
            order={(orders ?? []).find((o) => o._id === selectedId)!}
            onClose={() => setSelectedId(null)}
          />
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
