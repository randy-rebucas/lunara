export const PARTNER_NOTIFICATION_CATEGORY = {
  INCOMING: 'incoming',
  PICKUP: 'pickup',
  RECEIVING: 'receiving',
  PROCESSING: 'processing',
  DELIVERY: 'delivery',
  STAFF: 'staff',
  SYSTEM: 'system',
  MESSAGE: 'message',
} as const;

export type PartnerNotificationCategory =
  (typeof PARTNER_NOTIFICATION_CATEGORY)[keyof typeof PARTNER_NOTIFICATION_CATEGORY];

export const PARTNER_NOTIFICATION_CATEGORY_LABELS: Record<PartnerNotificationCategory, string> = {
  incoming: 'Incoming',
  pickup: 'Pickup',
  receiving: 'Receiving',
  processing: 'Processing',
  delivery: 'Delivery',
  staff: 'Staff',
  system: 'System',
  message: 'Message',
};

export interface PortalNotification {
  _id: string;
  title: string;
  body: string;
  read: boolean;
  category?: PartnerNotificationCategory;
  createdAt: string;
  data?: {
    category?: PartnerNotificationCategory;
    type?: string;
    orderId?: string;
    event?: string;
    status?: string;
    branchName?: string;
  };
}

export type PortalNotificationRoute =
  | { kind: 'incoming' }
  | { kind: 'queue' }
  | { kind: 'progress' }
  | { kind: 'order'; orderId: string }
  | { kind: 'receiving'; orderId: string }
  | { kind: 'messages' };

export function resolveNotificationCategory(
  notification: PortalNotification,
): PartnerNotificationCategory {
  const type = notification.data?.type;
  if (notification.category) return notification.category;
  if (notification.data?.category) return notification.data.category;

  switch (type) {
    case 'shop_assigned':
    case 'order_accepted':
    case 'pickup_requested':
      return PARTNER_NOTIFICATION_CATEGORY.INCOMING;
    case 'pickup_rider_assigned':
    case 'picked_up':
    case 'in_transit_to_shop':
      return PARTNER_NOTIFICATION_CATEGORY.PICKUP;
    case 'laundry_received':
    case 'received_at_shop':
      return PARTNER_NOTIFICATION_CATEGORY.RECEIVING;
    case 'staff_assigned':
    case 'staff_job_accepted':
      return PARTNER_NOTIFICATION_CATEGORY.STAFF;
    case 'ready_for_delivery':
    case 'delivery_requested':
    case 'delivery_rider_assigned':
    case 'out_for_delivery':
    case 'delivered':
      return PARTNER_NOTIFICATION_CATEGORY.DELIVERY;
    default:
      return PARTNER_NOTIFICATION_CATEGORY.SYSTEM;
  }
}

export function resolvePortalNotificationRoute(
  notification: PortalNotification,
): PortalNotificationRoute | null {
  const orderId = notification.data?.orderId;
  const type = notification.data?.type;
  const status = notification.data?.status;

  if (type === 'shop_assigned' || type === 'pickup_requested' || type === 'order_accepted') {
    return { kind: 'incoming' };
  }

  if (
    type === 'laundry_received' ||
    type === 'in_transit_to_shop' ||
    status === 'in_transit_to_shop'
  ) {
    return orderId ? { kind: 'receiving', orderId } : { kind: 'incoming' };
  }

  if (
    type === 'received_at_shop' ||
    type === 'staff_job_accepted' ||
    type === 'staff_assigned' ||
    status === 'received_at_shop'
  ) {
    return orderId ? { kind: 'order', orderId } : { kind: 'queue' };
  }

  if (type === 'ready_for_delivery' || status === 'ready_for_delivery') {
    return orderId ? { kind: 'order', orderId } : { kind: 'progress' };
  }

  if (type === 'new_message') {
    return { kind: 'messages' };
  }

  if (orderId) {
    return { kind: 'order', orderId };
  }

  return null;
}

export function notificationRouteToPath(route: PortalNotificationRoute): string {
  switch (route.kind) {
    case 'incoming':
      return '/orders/incoming';
    case 'queue':
      return '/orders';
    case 'progress':
      return '/orders/progress';
    case 'receiving':
      return `/orders/${route.orderId}/receiving`;
    case 'order':
      return `/orders/${route.orderId}`;
    case 'messages':
      return '/messages';
  }
}

export function notificationActionLabel(route: PortalNotificationRoute): string {
  switch (route.kind) {
    case 'incoming':
      return 'View incoming →';
    case 'queue':
      return 'Open queue →';
    case 'progress':
      return 'Monitor progress →';
    case 'receiving':
      return 'Shop receiving →';
    case 'order':
      return 'Open order →';
    case 'messages':
      return 'Open messages →';
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
