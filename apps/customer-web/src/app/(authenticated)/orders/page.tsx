'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OrderStatus } from '@lunara/types';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import {
  buildCustomerTimeline,
  formatCurrency,
  formatOrderStatusLabel,
  isActiveOrderStatus,
  type PartnerCoverageInfo,
} from '@lunara/utils';
import { OrderPartnerCoverageNotice } from '../../../components/order-partner-coverage-notice';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageShell } from '../../../components/page-shell';
import { Card, CardBody } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { useInfiniteScroll } from '../../../hooks/use-infinite-scroll';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { loadCustomerSettings } from '../../../lib/customer-settings';

interface OrderSummary {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  createdAt?: string;
  branchId?: string;
  branchName?: string;
  partnerCoverage?: PartnerCoverageInfo;
}

interface OrdersPageData {
  items: OrderSummary[];
  totalPages: number;
  page: number;
}

const PAGE_SIZE = 15;

export default function OrdersPage() {
  const { api } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);
  const [emphasizeUpdates, setEmphasizeUpdates] = useState(
    () => loadCustomerSettings().emphasizeOrderUpdates,
  );

  useEffect(() => {
    const sync = () => setEmphasizeUpdates(loadCustomerSettings().emphasizeOrderUpdates);
    window.addEventListener('lunara-customer-settings', sync);
    return () => window.removeEventListener('lunara-customer-settings', sync);
  }, []);

  const hasMore = page > 0 && page < totalPages;

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!ready) return;

      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const res = await api.get<OrdersPageData>(
          `/orders?page=${pageNum}&limit=${PAGE_SIZE}`,
        );
        const { items, totalPages: nextTotalPages, page: currentPage } = res.data;
        setOrders((prev) => (append ? [...prev, ...items] : items));
        setTotalPages(nextTotalPages);
        setPage(currentPage);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load orders');
        if (!append) setOrders([]);
      } finally {
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [ready, api],
  );

  useEffect(() => {
    if (!ready) return;
    setOrders([]);
    setPage(0);
    setTotalPages(0);
    fetchPage(1, false);
  }, [ready, api, fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    fetchPage(page + 1, true);
  }, [hasMore, loading, loadingMore, page, fetchPage]);

  async function cancelOrder(order: OrderSummary) {
    const isPending = order.status === OrderStatus.PENDING;
    const message = isPending
      ? 'Delete this unpaid order? You can book again anytime. This cannot be undone.'
      : 'Cancel this order before it is dispatched? Wallet and online payments are refunded to your Lunara wallet. Cash orders are cancelled with no charge.';
    if (!window.confirm(message)) return;

    setCancellingId(order._id);
    setError('');
    try {
      await api.delete(`/orders/${order._id}`);
      setOrders((prev) => prev.filter((o) => o._id !== order._id));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : isPending
            ? 'Could not delete order'
            : 'Could not cancel order',
      );
    } finally {
      setCancellingId(null);
    }
  }

  function canCancelOrder(order: OrderSummary) {
    if (order.status === OrderStatus.PENDING) return true;
    if (order.status === OrderStatus.PENDING_DISPATCH) {
      return !order.branchId && !order.branchName;
    }
    return false;
  }

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    loading: loading || loadingMore,
  });

  if (isLoading || !ready) {
    return <AuthLoading message="Loading orders…" />;
  }

  return (
    <PageShell>
      <PageHeader
        title="My orders"
        description="Select an order to view the full timeline and live status updates"
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading orders…" />

      <div className="mt-6 list-stack">
        {!loading && !error && orders.length === 0 ? (
          <Card>
            <CardBody className="text-center text-muted">
              No orders yet.{' '}
              <Link href="/book" className="link-primary">
                Book laundry
              </Link>
            </CardBody>
          </Card>
        ) : (
          orders.map((o) => {
            const { progressPercent, currentStepLabel } = buildCustomerTimeline(o.status);
            const isPending = o.status === OrderStatus.PENDING;
            const showCancel = canCancelOrder(o);
            const orderHref = isPending ? `/checkout/${o._id}` : `/orders/${o._id}`;
            const cancelLabel =
              o.status === OrderStatus.PENDING_DISPATCH ? 'Cancel' : 'Delete';
            return (
              <Card
                key={o._id}
                className={`transition-shadow hover:shadow-[var(--shadow-elevated)] ${
                  emphasizeUpdates && isActiveOrderStatus(o.status)
                    ? 'ring-2 ring-primary/25'
                    : ''
                }`}
              >
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <Link href={orderHref} className="min-w-0 flex-1">
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-medium capitalize text-slate-900">
                            {o.bookingType.replace(/_/g, ' ')}
                          </p>
                          <p className="mt-1 text-sm font-medium text-primary">
                            {currentStepLabel}
                          </p>
                          <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                            {formatOrderStatusLabel(o.status)}
                          </p>
                          {o.status === OrderStatus.PENDING_DISPATCH && (
                            <OrderPartnerCoverageNotice coverage={o.partnerCoverage} />
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">{formatCurrency(o.total)}</p>
                          {isPending ? (
                            <p className="mt-1 text-xs font-medium text-amber-700">Pay →</p>
                          ) : (
                            <p className="mt-1 text-xs text-muted-foreground">Track →</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </Link>
                    {showCancel && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={cancellingId === o._id}
                        onClick={() => cancelOrder(o)}
                      >
                        {cancellingId === o._id
                          ? o.status === OrderStatus.PENDING_DISPATCH
                            ? 'Cancelling…'
                            : 'Deleting…'
                          : cancelLabel}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>

      {!loading && !error && orders.length > 0 && (
        <div ref={sentinelRef} className="mt-6 flex justify-center py-2" aria-hidden={!hasMore && !loadingMore}>
          {loadingMore && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              Loading more orders…
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
