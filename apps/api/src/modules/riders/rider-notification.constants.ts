export const RIDER_NOTIFICATION_CATEGORY = {
  ASSIGNMENT: 'assignment',
  REMINDER: 'reminder',
  EARNINGS: 'earnings',
  SYSTEM: 'system',
} as const;

export type RiderNotificationCategory =
  (typeof RIDER_NOTIFICATION_CATEGORY)[keyof typeof RIDER_NOTIFICATION_CATEGORY];

export const RIDER_NOTIFICATION_TITLES = {
  NEW_PICKUP_ASSIGNED: 'New Pickup Assigned',
  NEW_DELIVERY_ASSIGNED: 'New Delivery Assigned',
  PICKUP_OVERDUE: 'Pickup Overdue',
  EARNINGS_CREDITED: 'Earnings Credited',
  PLATFORM_ANNOUNCEMENT: 'Platform Announcement',
} as const;

export const RIDER_NOTIFICATION_TYPES = {
  PICKUP_ASSIGNMENT: 'pickup_assignment',
  DELIVERY_ASSIGNMENT: 'delivery_assignment',
  PICKUP_OVERDUE: 'pickup_overdue',
  EARNINGS_CREDITED: 'earnings_credited',
  PLATFORM_ANNOUNCEMENT: 'platform_announcement',
} as const;

export function inferRiderNotificationCategory(
  type?: string,
): RiderNotificationCategory {
  switch (type) {
    case RIDER_NOTIFICATION_TYPES.PICKUP_ASSIGNMENT:
    case RIDER_NOTIFICATION_TYPES.DELIVERY_ASSIGNMENT:
    case 'pickup_offer':
    case 'delivery_offer':
      return RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT;
    case RIDER_NOTIFICATION_TYPES.PICKUP_OVERDUE:
      return RIDER_NOTIFICATION_CATEGORY.REMINDER;
    case RIDER_NOTIFICATION_TYPES.EARNINGS_CREDITED:
      return RIDER_NOTIFICATION_CATEGORY.EARNINGS;
    case RIDER_NOTIFICATION_TYPES.PLATFORM_ANNOUNCEMENT:
      return RIDER_NOTIFICATION_CATEGORY.SYSTEM;
    default:
      return RIDER_NOTIFICATION_CATEGORY.SYSTEM;
  }
}

export function riderNotificationChannelId(category: RiderNotificationCategory): string {
  switch (category) {
    case RIDER_NOTIFICATION_CATEGORY.ASSIGNMENT:
      return 'assignments';
    case RIDER_NOTIFICATION_CATEGORY.REMINDER:
      return 'reminders';
    case RIDER_NOTIFICATION_CATEGORY.EARNINGS:
      return 'earnings';
    case RIDER_NOTIFICATION_CATEGORY.SYSTEM:
    default:
      return 'system';
  }
}
