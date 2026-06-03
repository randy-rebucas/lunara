export const PARTNER_NOTIFICATION_CATEGORY = {
  INCOMING: 'incoming',
  PICKUP: 'pickup',
  RECEIVING: 'receiving',
  PROCESSING: 'processing',
  DELIVERY: 'delivery',
  STAFF: 'staff',
  SYSTEM: 'system',
} as const;

export type PartnerNotificationCategory =
  (typeof PARTNER_NOTIFICATION_CATEGORY)[keyof typeof PARTNER_NOTIFICATION_CATEGORY];

export const PARTNER_NOTIFICATION_TYPES = {
  SHOP_ASSIGNED: 'shop_assigned',
  ORDER_ACCEPTED: 'order_accepted',
  PICKUP_REQUESTED: 'pickup_requested',
  PICKUP_RIDER_ASSIGNED: 'pickup_rider_assigned',
  PICKED_UP: 'picked_up',
  IN_TRANSIT_TO_SHOP: 'in_transit_to_shop',
  LAUNDRY_RECEIVED: 'laundry_received',
  RECEIVED_AT_SHOP: 'received_at_shop',
  STAFF_ASSIGNED: 'staff_assigned',
  STAFF_JOB_ACCEPTED: 'staff_job_accepted',
  READY_FOR_DELIVERY: 'ready_for_delivery',
  DELIVERY_REQUESTED: 'delivery_requested',
  DELIVERY_RIDER_ASSIGNED: 'delivery_rider_assigned',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  ORDER_STATUS: 'order_status',
} as const;

/** Order events that should create partner/staff in-app notifications. */
export const PARTNER_RELEVANT_ORDER_EVENTS = new Set([
  'shopAssigned',
  'riderAssignedPickup',
  'riderAssigned',
  'pickedUp',
  'inTransitToShop',
  'laundryReceivedAtShop',
  'receivedAtShop',
  'staffAssigned',
  'staffJobAccepted',
  'awaitingDeliveryDispatch',
  'riderAssignedDelivery',
  'deliveryRiderAssigned',
  'riderPickedUpFromShop',
  'outForDelivery',
  'delivered',
  'completed',
]);

export const PARTNER_RELEVANT_ORDER_STATUSES = new Set([
  'shop_assigned',
  'rider_assigned_pickup',
  'picked_up',
  'in_transit_to_shop',
  'received_at_shop',
  'ready_for_delivery',
  'rider_assigned_delivery',
  'out_for_delivery',
  'delivered',
  'completed',
]);

export function inferPartnerNotificationCategory(
  type?: string,
): PartnerNotificationCategory {
  switch (type) {
    case PARTNER_NOTIFICATION_TYPES.SHOP_ASSIGNED:
    case PARTNER_NOTIFICATION_TYPES.ORDER_ACCEPTED:
    case PARTNER_NOTIFICATION_TYPES.PICKUP_REQUESTED:
      return PARTNER_NOTIFICATION_CATEGORY.INCOMING;
    case PARTNER_NOTIFICATION_TYPES.PICKUP_RIDER_ASSIGNED:
    case PARTNER_NOTIFICATION_TYPES.PICKED_UP:
    case PARTNER_NOTIFICATION_TYPES.IN_TRANSIT_TO_SHOP:
      return PARTNER_NOTIFICATION_CATEGORY.PICKUP;
    case PARTNER_NOTIFICATION_TYPES.LAUNDRY_RECEIVED:
    case PARTNER_NOTIFICATION_TYPES.RECEIVED_AT_SHOP:
      return PARTNER_NOTIFICATION_CATEGORY.RECEIVING;
    case PARTNER_NOTIFICATION_TYPES.STAFF_ASSIGNED:
    case PARTNER_NOTIFICATION_TYPES.STAFF_JOB_ACCEPTED:
      return PARTNER_NOTIFICATION_CATEGORY.STAFF;
    case PARTNER_NOTIFICATION_TYPES.READY_FOR_DELIVERY:
    case PARTNER_NOTIFICATION_TYPES.DELIVERY_REQUESTED:
    case PARTNER_NOTIFICATION_TYPES.DELIVERY_RIDER_ASSIGNED:
    case PARTNER_NOTIFICATION_TYPES.OUT_FOR_DELIVERY:
    case PARTNER_NOTIFICATION_TYPES.DELIVERED:
      return PARTNER_NOTIFICATION_CATEGORY.DELIVERY;
    default:
      return PARTNER_NOTIFICATION_CATEGORY.SYSTEM;
  }
}

export function partnerNotificationTypeFromEvent(event: string): string {
  switch (event) {
    case 'shopAssigned':
      return PARTNER_NOTIFICATION_TYPES.SHOP_ASSIGNED;
    case 'partnerAccepted':
      return PARTNER_NOTIFICATION_TYPES.ORDER_ACCEPTED;
    case 'riderAssignedPickup':
    case 'riderAssigned':
      return PARTNER_NOTIFICATION_TYPES.PICKUP_RIDER_ASSIGNED;
    case 'pickedUp':
      return PARTNER_NOTIFICATION_TYPES.PICKED_UP;
    case 'inTransitToShop':
      return PARTNER_NOTIFICATION_TYPES.IN_TRANSIT_TO_SHOP;
    case 'laundryReceivedAtShop':
      return PARTNER_NOTIFICATION_TYPES.LAUNDRY_RECEIVED;
    case 'receivedAtShop':
      return PARTNER_NOTIFICATION_TYPES.RECEIVED_AT_SHOP;
    case 'staffAssigned':
      return PARTNER_NOTIFICATION_TYPES.STAFF_ASSIGNED;
    case 'staffJobAccepted':
      return PARTNER_NOTIFICATION_TYPES.STAFF_JOB_ACCEPTED;
    case 'awaitingDeliveryDispatch':
      return PARTNER_NOTIFICATION_TYPES.READY_FOR_DELIVERY;
    case 'riderAssignedDelivery':
    case 'deliveryRiderAssigned':
      return PARTNER_NOTIFICATION_TYPES.DELIVERY_RIDER_ASSIGNED;
    case 'riderPickedUpFromShop':
    case 'outForDelivery':
      return PARTNER_NOTIFICATION_TYPES.OUT_FOR_DELIVERY;
    case 'delivered':
    case 'completed':
      return PARTNER_NOTIFICATION_TYPES.DELIVERED;
    default:
      return PARTNER_NOTIFICATION_TYPES.ORDER_STATUS;
  }
}

export function partnerOrderEventTitle(event: string): string {
  switch (event) {
    case 'shopAssigned':
      return 'New order for your shop';
    case 'partnerAccepted':
      return 'Order accepted';
    case 'riderAssignedPickup':
    case 'riderAssigned':
      return 'Pickup rider assigned';
    case 'pickedUp':
      return 'Laundry picked up';
    case 'inTransitToShop':
      return 'Laundry heading to shop';
    case 'laundryReceivedAtShop':
      return 'Receive at shop';
    case 'receivedAtShop':
      return 'Ready to process';
    case 'staffAssigned':
      return 'Staff assigned';
    case 'staffJobAccepted':
      return 'Processing started';
    case 'awaitingDeliveryDispatch':
      return 'Ready for delivery';
    case 'riderAssignedDelivery':
    case 'deliveryRiderAssigned':
      return 'Delivery rider assigned';
    case 'riderPickedUpFromShop':
      return 'Out for delivery';
    case 'outForDelivery':
      return 'Out for delivery';
    case 'delivered':
    case 'completed':
      return 'Order delivered';
    default:
      return 'Order update';
  }
}

export function partnerOrderStatusTitle(status: string): string {
  switch (status) {
    case 'shop_assigned':
      return 'New shop assignment';
    case 'rider_assigned_pickup':
      return 'Pickup rider assigned';
    case 'picked_up':
      return 'Laundry picked up';
    case 'in_transit_to_shop':
      return 'Laundry en route';
    case 'received_at_shop':
      return 'Received at shop';
    case 'ready_for_delivery':
      return 'Ready for delivery';
    case 'rider_assigned_delivery':
      return 'Delivery rider assigned';
    case 'out_for_delivery':
      return 'Out for delivery';
    case 'delivered':
    case 'completed':
      return 'Order completed';
    default:
      return 'Status updated';
  }
}
