'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { OrderStatus } from '@lunara/types';
import { formatCurrency, formatOrderStatusLabel } from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { Card, CardBody } from './ui/card';
import { isOpenRefundStatus } from '../lib/refunds';

interface OrderOption {
  _id: string;
  status: string;
  total: number;
  createdAt?: string;
  refundable?: boolean;
}

interface RefundRow {
  _id: string;
  orderId: string;
  status: string;
}

const NOT_REFUNDABLE_STATUSES = new Set<string>([
  OrderStatus.PENDING,
  OrderStatus.REFUNDED,
]);

interface RefundRequestSectionProps {
  existingRefunds?: RefundRow[];
}

export function RefundRequestSection({ existingRefunds = [] }: RefundRequestSectionProps) {
  const { api } = useAuthContext();
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const blockedOrderIds = new Set(
        existingRefunds.filter((r) => isOpenRefundStatus(r.status)).map((r) => r.orderId),
      );
      const res = await api.get<{ items: OrderOption[] }>('/orders?page=1&limit=30');
      const eligible = res.data.items.filter(
        (o) =>
          o.refundable === true &&
          !NOT_REFUNDABLE_STATUSES.has(o.status) &&
          !blockedOrderIds.has(o._id),
      );
      setOrders(eligible);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [api, existingRefunds]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Request a refund</h2>
          <p className="mt-1 text-sm text-muted">
            Refunds apply to wallet or online payments only — not cash on pickup or delivery.
            Choose an order, explain the issue, and we will review your request. Approved amounts
            are credited to your{' '}
            <Link href="/wallet" className="link-primary">
              wallet
            </Link>
            .
          </p>
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Select a paid order below (or open an order and tap Request refund).</li>
          <li>Describe why you need a refund (at least 10 characters).</li>
          <li>Track progress here after submission.</li>
        </ol>

        {loading && <p className="text-sm text-muted">Loading eligible orders…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && orders.length === 0 && (
          <p className="text-sm text-muted">
            No eligible orders right now. Refunds need a paid wallet or online order — cash orders
            are not refundable here. Open{' '}
            <Link href="/orders" className="link-primary">
              My orders
            </Link>{' '}
            for an order you paid, or check back if a request is already under review.
          </p>
        )}
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o._id}>
              <Link
                href={`/orders/${o._id}/refund`}
                className="flex items-center justify-between rounded-lg bg-surface-muted px-4 py-3 text-sm ring-1 ring-border/50 transition-shadow hover:shadow-[var(--shadow-elevated)]"
              >
                <span>
                  Order …{o._id.slice(-6)}
                  <span className="ml-2 text-muted">
                    {formatOrderStatusLabel(o.status)} · {formatCurrency(o.total)}
                  </span>
                </span>
                <span className="font-medium text-primary">Request →</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
