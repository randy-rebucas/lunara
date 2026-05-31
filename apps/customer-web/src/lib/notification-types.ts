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

export function notificationRouteToPath(route: NotificationRoute): string {
  switch (route.kind) {
    case 'review':
      return `/orders/${route.orderId}/review`;
    case 'order':
      return `/orders/${route.orderId}`;
    case 'refund':
      return `/refunds/${route.refundId}`;
    case 'wallet':
      return '/wallet';
  }
}

export function notificationActionLabel(route: NotificationRoute): string {
  switch (route.kind) {
    case 'review':
      return 'Leave a review →';
    case 'refund':
      return 'View refund →';
    case 'wallet':
      return 'View wallet →';
    case 'order':
      return 'View order →';
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
