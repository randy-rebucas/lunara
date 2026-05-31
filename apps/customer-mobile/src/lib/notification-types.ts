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
  | { kind: 'wallet' };

export function resolveNotificationRoute(notification: AppNotification): NotificationRoute | null {
  const type = notification.data?.type;
  const orderId = notification.data?.orderId;

  if (type === 'review_request' && orderId) {
    return { kind: 'review', orderId };
  }
  if (type === 'refund_update') {
    return orderId ? { kind: 'order', orderId } : { kind: 'wallet' };
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
