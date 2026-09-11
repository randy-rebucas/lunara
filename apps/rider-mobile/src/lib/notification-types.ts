export const RIDER_NOTIFICATION_CATEGORY = {
  ASSIGNMENT: 'assignment',
  REMINDER: 'reminder',
  SYSTEM: 'system',
} as const;

export type RiderNotificationCategory =
  (typeof RIDER_NOTIFICATION_CATEGORY)[keyof typeof RIDER_NOTIFICATION_CATEGORY];

export const RIDER_NOTIFICATION_CATEGORY_LABELS: Record<RiderNotificationCategory, string> = {
  assignment: 'Assignment',
  reminder: 'Reminder',
  system: 'System',
};

export interface RiderNotification {
  _id: string;
  title: string;
  body: string;
  read: boolean;
  category?: RiderNotificationCategory;
  createdAt: string;
  data?: {
    category?: RiderNotificationCategory;
    type?: string;
    orderId?: string;
    status?: string;
    branchName?: string;
  };
}

export type RiderNotificationRoute =
  | { kind: 'pickup'; orderId: string }
  | { kind: 'delivery'; orderId: string };

export function resolveNotificationCategory(
  notification: RiderNotification,
): RiderNotificationCategory {
  return (
    notification.category ??
    notification.data?.category ??
    inferCategoryFromType(notification.data?.type)
  );
}

function inferCategoryFromType(type?: string): RiderNotificationCategory {
  switch (type) {
    case 'pickup_assignment':
    case 'delivery_assignment':
    case 'pickup_offer':
    case 'delivery_offer':
      return RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT;
    case 'pickup_overdue':
      return RIDER_NOTIFICATION_CATEGORY.REMINDER;
    default:
      return RIDER_NOTIFICATION_CATEGORY.SYSTEM;
  }
}

export function resolveRiderNotificationRoute(
  notification: RiderNotification,
): RiderNotificationRoute | null {
  const orderId = notification.data?.orderId;
  if (!orderId) return null;

  const type = notification.data?.type;
  if (
    type === 'delivery_assignment' ||
    type === 'delivery_offer' ||
    notification.data?.status === 'rider_assigned_delivery'
  ) {
    return { kind: 'delivery', orderId };
  }
  if (
    type === 'pickup_assignment' ||
    type === 'pickup_offer' ||
    type === 'pickup_overdue' ||
    notification.data?.status === 'rider_assigned_pickup'
  ) {
    return { kind: 'pickup', orderId };
  }

  // An order-related notification whose type/status doesn't match a known pickup or delivery
  // pattern (e.g. a future notification type, or a reassignment) — guessing 'pickup' here could
  // route the rider to a leg they were never assigned, which fails with a generic load error.
  // No confident route is safer than a wrong one: skip navigation, tapping still marks it read.
  return null;
}

export function formatNotificationTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function notificationCategoryIcon(
  category: RiderNotificationCategory,
): 'bag-handle-outline' | 'alarm-outline' | 'megaphone-outline' {
  switch (category) {
    case RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT:
      return 'bag-handle-outline';
    case RIDER_NOTIFICATION_CATEGORY.REMINDER:
      return 'alarm-outline';
    case RIDER_NOTIFICATION_CATEGORY.SYSTEM:
    default:
      return 'megaphone-outline';
  }
}
