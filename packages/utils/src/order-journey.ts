import { OrderStatus } from '@lunara/types';

/** Customer booking phase before operations dispatch. */
export const CUSTOMER_BOOKING_JOURNEY = [
  { id: 'book_laundry', label: 'Book Laundry', status: null as OrderStatus | null },
  { id: 'order_created', label: 'Order Created', status: OrderStatus.PENDING },
  { id: 'pending_dispatch', label: 'Pending Dispatch', status: OrderStatus.PENDING_DISPATCH },
  { id: 'shop_assigned', label: 'Shop Assigned', status: OrderStatus.SHOP_ASSIGNED },
] as const;

export function getCustomerBookingStepLabel(status: string): string {
  if (status === OrderStatus.PENDING) return 'Order Created';
  if (status === OrderStatus.PENDING_DISPATCH) return 'Pending Dispatch';
  if (status === OrderStatus.SHOP_ASSIGNED) return 'Shop Assigned';
  return '';
}

export function isPreDispatchStatus(status: string): boolean {
  return status === OrderStatus.PENDING || status === OrderStatus.PENDING_DISPATCH;
}
