import { OrderStatus } from '@lunara/types';

const TASK_STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.RIDER_ASSIGNED_PICKUP]: 'Pickup assigned',
  [OrderStatus.RIDER_ASSIGNED]: 'Pickup assigned',
  [OrderStatus.RIDER_ASSIGNED_DELIVERY]: 'Delivery assigned',
  [OrderStatus.PICKED_UP]: 'Picked up',
  [OrderStatus.IN_TRANSIT_TO_SHOP]: 'At shop',
  [OrderStatus.READY_FOR_DELIVERY]: 'Ready for delivery',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Out for delivery',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.COMPLETED]: 'Completed',
};

export function riderTaskStatusLabel(status: string): string {
  return TASK_STATUS_LABELS[status as OrderStatus] ?? status.replace(/_/g, ' ');
}
