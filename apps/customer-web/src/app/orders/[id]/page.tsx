'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { OrderStatus } from '@lunara/types';
import { Button } from '@lunara/ui';
import { ButtonLink } from '../../../components/ui/button-link';
import { resolveApiOrigin } from '@lunara/hooks';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import {
  buildCustomerTimeline,
  formatCurrency,
  formatOrderStatusLabel,
  type PartnerCoverageInfo,
} from '@lunara/utils';
import { HandoffQrCard } from '../../../components/handoff-qr-card';
import { OrderPartnerCoverageNotice } from '../../../components/order-partner-coverage-notice';
import { PageShell } from '../../../components/page-shell';
import { DataPageStatus } from '../../../components/data-page-status';
import { OrderNotifications, type OrderNotification } from '../../../components/order-notifications';
import { OrderTimeline } from '../../../components/order-timeline';
import { RiderLocationMap } from '../../../components/rider-location-map';
import { AuthLoading } from '../../../components/auth-loading';
import { useDebouncedCallback } from '../../../hooks/use-debounced-callback';
import { useProtectedPage } from '../../../hooks/use-protected-page';

interface OrderDetail {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  estimatedWeightKg?: number;
  scheduledPickupAt: string;
  createdAt?: string;
  pickup?: {
    receiptCode?: string;
    acceptedAt?: string;
    arrivedAt?: string;
  };
  delivery?: {
    receiptCode?: string;
    signatureName?: string;
    acceptedAt?: string;
    arrivedAt?: string;
  };
  statusHistory: { status: string; timestamp: string; note?: string }[];
  branchName?: string;
  branchCode?: string;
  partnerCoverage?: PartnerCoverageInfo;
  refundable?: boolean;
  paymentMethod?: string;
}

interface DeliveryUiState {
  needsVerify: boolean;
  needsSign: boolean;
}

const ORDER_EVENT_MESSAGES: Record<string, string> = {
  awaitingDispatch:
    'Payment received. Your order is pending dispatch to a laundry partner.',
  shopAssigned: 'Your order was assigned to a laundry partner shop.',
  riderAssignedPickup: 'A pickup rider has been assigned to your order.',
  branchAssigned: 'Your order was assigned to a laundry partner branch.',
  findingRider: 'Finding a nearby rider for your pickup…',
  riderAssigned: 'A rider accepted your pickup and is on the way.',
  riderArrived: 'Your rider has arrived at your address.',
  pickedUp: 'Laundry collected from your address.',
  pickupReceiptGenerated: 'Pickup receipt generated for your order.',
  inTransitToShop: 'Your laundry is on the way to the partner shop.',
  laundryReceivedAtShop: 'Laundry received at the partner shop.',
  shopWeightVerified: 'The shop verified your laundry weight.',
  receivedAtShop: 'Items confirmed at the partner shop.',
  processingAdvanced: 'Your laundry is being processed at the shop.',
  awaitingDeliveryDispatch:
    'Your laundry is ready. Lunara operations is assigning a delivery rider.',
  findingDeliveryRider: 'Looking for a rider to deliver your laundry…',
  riderAssignedDelivery: 'A delivery rider has been assigned to your order.',
  deliveryRiderAssigned: 'Your delivery rider is on the way.',
  riderPickedUpFromShop: 'Your laundry was picked up from the partner shop.',
  outForDelivery: 'Your clean laundry is on the way.',
  customerReceivedDelivery: 'You received your laundry from the rider.',
  deliveryPhotoProof: 'Delivery photo proof was captured.',
  deliveryRiderArrived: 'Your delivery rider has arrived.',
  customerVerifiedDelivery: 'You verified the delivery.',
  customerSignedDelivery: 'You signed for your delivery.',
  delivered: 'Laundry delivered successfully.',
  completed: 'Order complete. Thank you!',
  reviewRequested: 'How was your experience? Leave a review when you have a moment.',
  reviewPublished: 'Thank you for your review!',
};

function formatTime() {
  return new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export default function OrderTrackPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justBooked = searchParams.get('booked') === '1';
  const { api, tokens } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [socketLive, setSocketLive] = useState(false);
  const [deliveryUi, setDeliveryUi] = useState<DeliveryUiState | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [canReview, setCanReview] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const pushNotification = useCallback((message: string) => {
    setNotifications((prev) => [
      { id: crypto.randomUUID(), message, at: formatTime() },
      ...prev,
    ].slice(0, 12));
  }, []);

  const reload = useCallback(async () => {
    if (!id) return;
    setPageLoading(true);
    setLoadError('');
    try {
      const res = await api.get<OrderDetail>(`/orders/${id}`);
      setOrder(res.data);
      try {
        const deliveryRes = await api.get<DeliveryUiState>(`/orders/${id}/delivery`);
        setDeliveryUi(deliveryRes.data);
      } catch {
        setDeliveryUi(null);
      }
      try {
        const reviewRes = await api.get<{ canReview: boolean; review: { _id: string } | null }>(
          `/reviews/orders/${id}`,
        );
        setCanReview(reviewRes.data.canReview);
        setHasReview(!!reviewRes.data.review);
      } catch {
        setCanReview(false);
        setHasReview(false);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load order');
      setOrder(null);
    } finally {
      setPageLoading(false);
    }
  }, [id, api]);

  const scheduleReload = useDebouncedCallback(() => {
    reload().catch(() => {});
  }, 500);

  useEffect(() => {
    if (ready && id) {
      reload().catch(() => {});
    }
  }, [ready, id, reload]);

  useEffect(() => {
    if (justBooked) {
      pushNotification(
        'Payment received — Lunara is assigning your laundry partner. Pickup starts after dispatch.',
      );
    }
  }, [justBooked, pushNotification]);

  useEffect(() => {
    if (!id || !tokens?.accessToken) return;
    const apiUrl = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token: tokens.accessToken },
    });
    socket.emit('joinOrder', { orderId: id });
    setSocketLive(true);

    socket.on('orderStatusUpdate', (data: { status: string }) => {
      setOrder((prev) => (prev ? { ...prev, status: data.status } : prev));
      pushNotification(`Status updated: ${formatOrderStatusLabel(data.status)}`);
      scheduleReload();
    });

    socket.on(
      'orderEvent',
      (data: { event: string; message?: string }) => {
        const msg = data.message ?? ORDER_EVENT_MESSAGES[data.event];
        if (msg) pushNotification(msg);
        scheduleReload();
      },
    );

    socket.on('locationUpdate', (data: { lat: number; lng: number }) => {
      setLocation({ lat: data.lat, lng: data.lng });
    });

    return () => {
      setSocketLive(false);
      socket.disconnect();
    };
  }, [id, tokens?.accessToken, scheduleReload, pushNotification]);

  async function handleVerify() {
    setDeliveryError('');
    try {
      await api.post(`/orders/${id}/delivery/verify`, { code: verifyCode });
      setVerifyCode('');
      reload();
    } catch (e) {
      setDeliveryError(e instanceof Error ? e.message : 'Verification failed');
    }
  }

  async function handleCancelPendingDispatch() {
    if (
      !window.confirm(
        'Cancel this order before it is dispatched? Wallet and online payments are refunded to your Lunara wallet. Cash orders are cancelled with no charge.',
      )
    ) {
      return;
    }
    setCancelling(true);
    setLoadError('');
    try {
      await api.delete(`/orders/${id}`);
      router.push('/orders');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not cancel order');
    } finally {
      setCancelling(false);
    }
  }

  async function handleSign() {
    setDeliveryError('');
    try {
      await api.post(`/orders/${id}/delivery/sign`, { signatureName });
      reload();
    } catch (e) {
      setDeliveryError(e instanceof Error ? e.message : 'Sign failed');
    }
  }

  if (isLoading || !ready) {
    return <AuthLoading message="Loading order…" />;
  }

  if (pageLoading) {
    return (
      <PageShell narrow>
        <Link href="/orders" className="text-sm text-muted transition-colors hover:text-primary">
          ← My orders
        </Link>
        <p className="mt-4 text-sm text-muted">Loading order…</p>
      </PageShell>
    );
  }

  if (loadError || !order) {
    return (
      <PageShell narrow>
        <Link href="/orders" className="text-sm text-muted transition-colors hover:text-primary">
          ← My orders
        </Link>
        <DataPageStatus loading={false} error={loadError || 'Order not found'} loadingMessage="" />
      </PageShell>
    );
  }

  const timeline = buildCustomerTimeline(order.status, order.statusHistory);
  const showDeliveryActions =
    order.status === OrderStatus.OUT_FOR_DELIVERY ||
    order.status === OrderStatus.RIDER_ASSIGNED_DELIVERY;
  const showPickupQr =
    order.status === OrderStatus.RIDER_ASSIGNED_PICKUP ||
    order.status === OrderStatus.RIDER_ASSIGNED;
  const showDeliveryQr = order.status === OrderStatus.OUT_FOR_DELIVERY;

  return (
    <PageShell>
      <Link href="/orders" className="text-sm text-muted transition-colors hover:text-primary">
        ← My orders
      </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Track order</h1>
            <p className="mt-1 capitalize text-slate-600">
              {order.bookingType.replace(/_/g, ' ')} · {formatCurrency(order.total)}
              {order.estimatedWeightKg ? ` · ~${order.estimatedWeightKg} kg` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-primary">{timeline.currentStepLabel}</p>
            <p className="text-xs text-slate-500">{timeline.progressPercent}% complete</p>
          </div>
        </div>

        {order.branchName && (
          <div className="mt-4 rounded-lg bg-primary/5 p-4 text-sm ring-1 ring-primary/15">
            <p className="font-medium text-primary">
              {order.status === OrderStatus.SHOP_ASSIGNED ? 'Shop assigned' : 'Assigned branch'}
            </p>
            <p className="mt-1 text-slate-700">
              {order.branchName}
              {order.branchCode ? ` (${order.branchCode})` : ''}
            </p>
          </div>
        )}

        {order.status === OrderStatus.PENDING_DISPATCH && !order.branchName && (
          <OrderPartnerCoverageNotice
            coverage={order.partnerCoverage}
            className="mt-4"
          />
        )}

        {order.status === OrderStatus.PENDING && (
          <div className="mt-4 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200/60">
            <p className="text-sm font-medium text-amber-900">Order created — payment required</p>
            <p className="mt-1 text-sm text-amber-800">
              Complete payment to move your order to pending dispatch.
            </p>
            <Link href={`/checkout/${id}`} className="mt-3 inline-block text-sm font-medium text-primary">
              Go to checkout →
            </Link>
          </div>
        )}

        {order.status === OrderStatus.PENDING_DISPATCH && !order.branchName && (
          <div className="mt-4 rounded-lg bg-primary/5 p-4 text-sm ring-1 ring-primary/15">
            <p className="font-medium text-primary">Pending dispatch</p>
            <p className="mt-1 text-slate-700">
              Payment received. Lunara operations is assigning your laundry partner. Pickup starts
              after dispatch.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 border-red-200 text-red-600 hover:bg-red-50"
              disabled={cancelling}
              onClick={handleCancelPendingDispatch}
            >
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </Button>
          </div>
        )}

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${timeline.progressPercent}%` }}
          />
        </div>

        <div className="mt-6">
          <OrderNotifications notifications={notifications} live={socketLive} />
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <p className="mt-1 text-sm text-slate-500">Live updates as your order moves through each step</p>
          <div className="mt-6 panel">
            <OrderTimeline steps={timeline.steps} />
          </div>
        </section>

        {location && <RiderLocationMap lat={location.lat} lng={location.lng} />}

        {showPickupQr && id ? <HandoffQrCard orderId={id} context="pickup" /> : null}
        {showDeliveryQr && id ? <HandoffQrCard orderId={id} context="delivery" /> : null}

        {showDeliveryActions && deliveryUi?.needsVerify && (
          <div className="panel mt-6">
            <p className="font-medium">Customer receives</p>
            <p className="mt-1 text-sm text-slate-600">
              Enter the last 4 digits of your mobile number to confirm you received your laundry
            </p>
            <input
              className="input-field mt-3"
              placeholder="4-digit code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              maxLength={4}
            />
            <Button className="mt-3 w-full" size="lg" onClick={handleVerify}>
              Verify
            </Button>
          </div>
        )}

        {deliveryUi?.needsSign && (
          <div className="panel mt-6">
            <p className="font-medium">Signature</p>
            <p className="mt-1 text-sm text-slate-600">
              Sign after the rider captures photo proof of delivery
            </p>
            <input
              className="input-field mt-3"
              placeholder="Your full name"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
            />
            <Button className="mt-3 w-full" size="lg" onClick={handleSign}>
              Sign & confirm
            </Button>
          </div>
        )}

        {deliveryError && <p className="mt-3 text-sm text-red-500">{deliveryError}</p>}

        {(order.pickup?.receiptCode || order.delivery?.receiptCode) && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {order.pickup?.receiptCode && (
              <div className="rounded-lg bg-accent/5 p-4 ring-1 ring-accent/15">
                <p className="text-xs font-medium text-slate-500">Pickup receipt</p>
                <p className="mt-1 font-mono text-sm">{order.pickup.receiptCode}</p>
              </div>
            )}
            {order.delivery?.receiptCode && (
              <div className="rounded-lg bg-accent/5 p-4 ring-1 ring-accent/15">
                <p className="text-xs font-medium text-slate-500">Delivery receipt</p>
                <p className="mt-1 font-mono text-sm">{order.delivery.receiptCode}</p>
                {order.delivery.signatureName && (
                  <p className="mt-1 text-xs text-slate-600">Signed: {order.delivery.signatureName}</p>
                )}
              </div>
            )}
          </div>
        )}

        {timeline.isTerminal && order.status === OrderStatus.COMPLETED && (
          <div className="panel mt-6 bg-primary/5 text-center ring-1 ring-primary/15">
            <p className="font-semibold text-primary">All done!</p>
            <p className="mt-1 text-sm text-slate-600">Thanks for using Lunara.</p>
            {canReview && (
              <ButtonLink href={`/orders/${id}/review`} className="mt-4">
                Rate your experience
              </ButtonLink>
            )}
            {hasReview && !canReview && (
              <Link
                href={`/orders/${id}/review`}
                className="mt-3 inline-block text-sm text-primary hover:underline"
              >
                View your published review →
              </Link>
            )}
            <div className="mt-4 list-stack-sm">
              <ButtonLink href={`/orders/${id}/lost-item`} variant="outline" className="w-full">
                Report missing item
              </ButtonLink>
              {order.refundable === true && (
                <ButtonLink href={`/orders/${id}/refund`} variant="outline" className="w-full">
                  Request refund
                </ButtonLink>
              )}
            </div>
          </div>
        )}

        {(order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Something missing?{' '}
            <Link href={`/orders/${id}/lost-item`} className="text-primary hover:underline">
              File a lost-item complaint
            </Link>
          </p>
        )}

        <div className="mt-8 btn-row">
          <ButtonLink href="/orders" variant="outline">
            My orders
          </ButtonLink>
          <ButtonLink href="/dashboard" variant="ghost">
            Dashboard
          </ButtonLink>
        </div>
    </PageShell>
  );
}
