import { OrderStatus } from '@lunara/types';

const ORDER_STATUS_FLOW: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PENDING_DISPATCH,
  OrderStatus.SHOP_ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.RECEIVED_AT_SHOP,
  OrderStatus.RECEIVED,
  OrderStatus.SORTING,
  OrderStatus.WASHING,
  OrderStatus.DRYING,
  OrderStatus.FOLDING,
  OrderStatus.IRONING,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

export function getNextOrderStatus(current: OrderStatus): OrderStatus | null {
  const index = ORDER_STATUS_FLOW.indexOf(current);
  if (index === -1 || index >= ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[index + 1] ?? null;
}

const PARTNER_ALLOWED_SKIPS: [OrderStatus, OrderStatus][] = [
  [OrderStatus.FOLDING, OrderStatus.QUALITY_CHECK],
  // Customer self-pickup path: skip the delivery rider flow entirely
  [OrderStatus.READY_FOR_DELIVERY, OrderStatus.CUSTOMER_PICKUP],
  [OrderStatus.CUSTOMER_PICKUP, OrderStatus.COMPLETED],
];

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (to === OrderStatus.CANCELLED || to === OrderStatus.REFUNDED) return true;
  const fromIndex = ORDER_STATUS_FLOW.indexOf(from);
  const toIndex = ORDER_STATUS_FLOW.indexOf(to);
  if (fromIndex >= 0 && toIndex === fromIndex + 1) return true;
  return PARTNER_ALLOWED_SKIPS.some(([f, t]) => f === from && t === to);
}
