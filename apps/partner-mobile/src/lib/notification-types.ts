import type { AppNotification } from '@lunara/types';

/** Mirrors PARTNER_NOTIFICATION_CATEGORY in apps/api/src/modules/push/partner-notification.constants.ts. */
export const STAFF_NOTIFICATION_CATEGORY = {
  INCOMING: 'incoming',
  PICKUP: 'pickup',
  RECEIVING: 'receiving',
  PROCESSING: 'processing',
  DELIVERY: 'delivery',
  STAFF: 'staff',
  SYSTEM: 'system',
} as const;

export type StaffNotificationCategory =
  (typeof STAFF_NOTIFICATION_CATEGORY)[keyof typeof STAFF_NOTIFICATION_CATEGORY];

export const STAFF_NOTIFICATION_CATEGORY_LABELS: Record<StaffNotificationCategory, string> = {
  incoming: 'Incoming',
  pickup: 'Pickup',
  receiving: 'Receiving',
  processing: 'Processing',
  delivery: 'Delivery',
  staff: 'Staff',
  system: 'System',
};

export type StaffNotification = AppNotification;

export function resolveNotificationCategory(notification: StaffNotification): StaffNotificationCategory {
  const type = notification.data?.type;
  if (notification.category) return notification.category as StaffNotificationCategory;
  if (notification.data?.category) return notification.data.category as StaffNotificationCategory;

  switch (type) {
    case 'shop_assigned':
    case 'order_accepted':
    case 'pickup_requested':
      return STAFF_NOTIFICATION_CATEGORY.INCOMING;
    case 'pickup_rider_assigned':
    case 'picked_up':
    case 'in_transit_to_shop':
      return STAFF_NOTIFICATION_CATEGORY.PICKUP;
    case 'laundry_received':
    case 'received_at_shop':
      return STAFF_NOTIFICATION_CATEGORY.RECEIVING;
    case 'staff_assigned':
    case 'staff_job_accepted':
      return STAFF_NOTIFICATION_CATEGORY.STAFF;
    case 'ready_for_delivery':
    case 'delivery_requested':
    case 'delivery_rider_assigned':
    case 'out_for_delivery':
    case 'delivered':
      return STAFF_NOTIFICATION_CATEGORY.DELIVERY;
    default:
      return STAFF_NOTIFICATION_CATEGORY.SYSTEM;
  }
}

export function notificationCategoryIcon(
  category: StaffNotificationCategory,
): 'download-outline' | 'bicycle-outline' | 'cube-outline' | 'construct-outline' | 'send-outline' | 'people-outline' | 'megaphone-outline' {
  switch (category) {
    case STAFF_NOTIFICATION_CATEGORY.INCOMING:
      return 'download-outline';
    case STAFF_NOTIFICATION_CATEGORY.PICKUP:
      return 'bicycle-outline';
    case STAFF_NOTIFICATION_CATEGORY.RECEIVING:
      return 'cube-outline';
    case STAFF_NOTIFICATION_CATEGORY.PROCESSING:
      return 'construct-outline';
    case STAFF_NOTIFICATION_CATEGORY.DELIVERY:
      return 'send-outline';
    case STAFF_NOTIFICATION_CATEGORY.STAFF:
      return 'people-outline';
    case STAFF_NOTIFICATION_CATEGORY.SYSTEM:
    default:
      return 'megaphone-outline';
  }
}

/** Order-related notifications route into the order detail screen; a still-incoming order (no
 * accept/receive step yet) routes to the receiving screen since that's the actionable next step
 * for staff. Falls back to no navigation when there's no order to open (tapping still marks read). */
export function resolveStaffNotificationRoute(notification: StaffNotification): string | null {
  const orderId = notification.data?.orderId;
  if (!orderId) return null;

  const type = notification.data?.type;
  if (type === 'laundry_received' || type === 'shop_assigned') {
    return `/order/${orderId}/receiving`;
  }
  return `/order/${orderId}`;
}

export function formatNotificationTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
