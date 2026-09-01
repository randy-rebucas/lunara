export interface AppNotification {
  _id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: {
    type?: string;
    orderId?: string;
    refundId?: string;
    status?: string;
    photoUrl?: string;
  };
}

export type NotificationRoute =
  | { kind: 'order'; orderId: string }
  | { kind: 'review'; orderId: string }
  | { kind: 'refund'; refundId: string }
  | { kind: 'wallet' };

export function resolveNotificationRoute(notification: AppNotification): NotificationRoute | null {
  const type = notification.data?.type;
  const orderId = notification.data?.orderId;
  const refundId = notification.data?.refundId;

  if (type === 'review_request' && orderId) {
    return { kind: 'review', orderId };
  }
  if (type === 'refund_update') {
    if (refundId) return { kind: 'refund', refundId };
    if (orderId) return { kind: 'order', orderId };
    return { kind: 'wallet' };
  }
  if (orderId) {
    return { kind: 'order', orderId };
  }
  return null;
}

export function notificationIconName(
  type?: string,
  hasOrder?: boolean,
): 'star-outline' | 'wallet-outline' | 'receipt-outline' | 'notifications-outline' {
  switch (type) {
    case 'review_request':
      return 'star-outline';
    case 'refund_update':
      return 'wallet-outline';
    default:
      return hasOrder ? 'receipt-outline' : 'notifications-outline';
  }
}

export function formatNotificationTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function notificationRouteToPath(
  route: NonNullable<ReturnType<typeof resolveNotificationRoute>>,
): string {
  switch (route.kind) {
    case 'review':
      return `/review/${route.orderId}`;
    case 'order':
      return `/orders/${route.orderId}`;
    case 'refund':
      return `/refunds/${route.refundId}`;
    case 'wallet':
      return '/(tabs)/wallet';
  }
}
