import { OrderStatus } from '@lunara/types';

const INACTIVE_STATUSES = new Set<string>([
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
]);

export function isActiveOrderStatus(status: string): boolean {
  return !INACTIVE_STATUSES.has(status);
}

export function formatOrderNumber(orderId: string): string {
  return `#${orderId.slice(-6).toUpperCase()}`;
}

export function formatEstimatedDelivery(iso?: string): string {
  if (!iso) return 'Est. delivery TBD';
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
