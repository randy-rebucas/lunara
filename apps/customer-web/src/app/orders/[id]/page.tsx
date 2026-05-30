'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { OrderStatus } from '@lunara/types';
import { Button } from '@lunara/ui';
import { resolveApiOrigin } from '@lunara/hooks';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { buildCustomerTimeline, formatCurrency, formatOrderStatusLabel } from '@lunara/utils';
import { CustomerNav } from '../../../components/customer-nav';
import { DataPageStatus } from '../../../components/data-page-status';
import { OrderNotifications, type OrderNotification } from '../../../components/order-notifications';
import { OrderTimeline } from '../../../components/order-timeline';

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
  const searchParams = useSearchParams();
  const justBooked = searchParams.get('booked') === '1';
  const { isAuthenticated, isLoading, api, tokens } = useAuthContext();
  const router = useRouter();
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

  const pushNotification = useCallback((message: string) => {
    setNotifications((prev) => [
      { id: crypto.randomUUID(), message, at: formatTime() },
      ...prev,
    ].slice(0, 12));
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

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

  useEffect(() => {
    if (isAuthenticated && id) {
      reload().catch(() => {});
    }
  }, [isAuthenticated, id, reload]);

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
      reload();
    });

    socket.on(
      'orderEvent',
      (data: { event: string; message?: string }) => {
        const msg = data.message ?? ORDER_EVENT_MESSAGES[data.event];
        if (msg) pushNotification(msg);
        reload();
      },
    );

    socket.on('locationUpdate', (data: { lat: number; lng: number }) => {
      setLocation({ lat: data.lat, lng: data.lng });
    });

    return () => {
      setSocketLive(false);
      socket.disconnect();
    };
  }, [id, tokens?.accessToken, reload, pushNotification]);

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

  async function handleSign() {
    setDeliveryError('');
    try {
      await api.post(`/orders/${id}/delivery/sign`, { signatureName });
      reload();
    } catch (e) {
      setDeliveryError(e instanceof Error ? e.message : 'Sign failed');
    }
  }

  if (isLoading || pageLoading) {
    return (
      <>
        <CustomerNav />
        <main className="mx-auto max-w-lg px-6 py-10">
          <Link href="/orders" className="text-sm text-slate-500 hover:text-primary">
            ← My orders
          </Link>
          <p className="mt-4 text-sm text-slate-500">Loading order…</p>
        </main>
      </>
    );
  }

  if (loadError || !order) {
    return (
      <>
        <CustomerNav />
        <main className="mx-auto max-w-lg px-6 py-10">
          <Link href="/orders" className="text-sm text-slate-500 hover:text-primary">
            ← My orders
          </Link>
          <DataPageStatus loading={false} error={loadError || 'Order not found'} loadingMessage="" />
        </main>
      </>
    );
  }

  const timeline = buildCustomerTimeline(order.status, order.statusHistory);
  const showDeliveryActions =
    order.status === OrderStatus.OUT_FOR_DELIVERY ||
    order.status === OrderStatus.RIDER_ASSIGNED_DELIVERY;

  return (
    <>
      <CustomerNav />
      <main className="mx-auto max-w-lg px-6 py-10">
        <Link href="/orders" className="text-sm text-slate-500 hover:text-primary">
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
          <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm">
            <p className="font-medium text-primary">
              {order.status === OrderStatus.SHOP_ASSIGNED ? 'Shop assigned' : 'Assigned branch'}
            </p>
            <p className="mt-1 text-slate-700">
              {order.branchName}
              {order.branchCode ? ` (${order.branchCode})` : ''}
            </p>
          </div>
        )}

        {order.status === OrderStatus.PENDING && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
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
          <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm">
            <p className="font-medium text-primary">Pending dispatch</p>
            <p className="mt-1 text-slate-700">
              Payment received. Lunara operations is assigning your laundry partner. Pickup starts
              after dispatch.
            </p>
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
          <div className="mt-6 rounded-xl border bg-white p-6">
            <OrderTimeline steps={timeline.steps} />
          </div>
        </section>

        {location && (
          <p className="mt-6 rounded-lg bg-slate-100 p-4 text-sm">
            <span className="font-medium">Rider location (live):</span>{' '}
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </p>
        )}

        {showDeliveryActions && deliveryUi?.needsVerify && (
          <div className="mt-6 rounded-xl border bg-white p-5">
            <p className="font-medium">Customer receives</p>
            <p className="mt-1 text-sm text-slate-600">
              Enter the last 4 digits of your mobile number to confirm you received your laundry
            </p>
            <input
              className="mt-3 w-full rounded-lg border px-4 py-2"
              placeholder="4-digit code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              maxLength={4}
            />
            <Button className="mt-3 w-full" onClick={handleVerify}>
              Verify
            </Button>
          </div>
        )}

        {deliveryUi?.needsSign && (
          <div className="mt-6 rounded-xl border bg-white p-5">
            <p className="font-medium">Signature</p>
            <p className="mt-1 text-sm text-slate-600">
              Sign after the rider captures photo proof of delivery
            </p>
            <input
              className="mt-3 w-full rounded-lg border px-4 py-2"
              placeholder="Your full name"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
            />
            <Button className="mt-3 w-full" onClick={handleSign}>
              Sign & confirm
            </Button>
          </div>
        )}

        {deliveryError && <p className="mt-3 text-sm text-red-500">{deliveryError}</p>}

        {(order.pickup?.receiptCode || order.delivery?.receiptCode) && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {order.pickup?.receiptCode && (
              <div className="rounded-lg border bg-green-50 p-4">
                <p className="text-xs font-medium text-slate-500">Pickup receipt</p>
                <p className="mt-1 font-mono text-sm">{order.pickup.receiptCode}</p>
              </div>
            )}
            {order.delivery?.receiptCode && (
              <div className="rounded-lg border bg-green-50 p-4">
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
          <div className="mt-6 rounded-xl border border-primary/30 bg-indigo-50 p-5 text-center">
            <p className="font-semibold text-primary">All done!</p>
            <p className="mt-1 text-sm text-slate-600">Thanks for using Lunara.</p>
            {canReview && (
              <Link href={`/orders/${id}/review`} className="mt-4 inline-block">
                <Button>Rate your experience</Button>
              </Link>
            )}
            {hasReview && !canReview && (
              <Link
                href={`/orders/${id}/review`}
                className="mt-3 inline-block text-sm text-primary hover:underline"
              >
                View your published review →
              </Link>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <Link href={`/orders/${id}/lost-item`}>
                <Button variant="outline" className="w-full">
                  Report missing item
                </Button>
              </Link>
              <Link href={`/orders/${id}/refund`}>
                <Button variant="outline" className="w-full">
                  Request refund
                </Button>
              </Link>
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

        <div className="mt-8 flex gap-3">
          <Link href="/orders">
            <Button variant="outline">My orders</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost">Dashboard</Button>
          </Link>
        </div>
      </main>
    </>
  );
}
