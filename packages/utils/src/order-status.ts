import { OrderStatus } from '@lunara/types';

/** Order has an assigned laundry shop (current or legacy status). */
export function isShopAssignedStatus(status: string): boolean {
  return status === OrderStatus.SHOP_ASSIGNED || status === OrderStatus.CONFIRMED;
}

/** Paid order awaiting admin shop assignment. */
export function isPendingDispatchStatus(status: string): boolean {
  return status === OrderStatus.PENDING_DISPATCH;
}

/** Pickup rider assigned (admin or marketplace accept). */
export function isPickupRiderAssignedStatus(status: string): boolean {
  return (
    status === OrderStatus.RIDER_ASSIGNED_PICKUP || status === OrderStatus.RIDER_ASSIGNED
  );
}

/** Shop assigned and awaiting pickup rider. */
export function isAwaitingPickupRiderStatus(status: string): boolean {
  return isShopAssignedStatus(status);
}
