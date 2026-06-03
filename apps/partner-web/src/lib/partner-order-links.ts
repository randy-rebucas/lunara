import type { PartnerOrderSummary } from '@lunara/types';
import { isPartnerLaundryProcessingStatus } from '@lunara/utils';

/** Best portal route for an order based on status and available actions. */
export function partnerOrderHref(
  order: Pick<PartnerOrderSummary, '_id' | 'status' | 'canReceiveAtShop'>,
): string {
  if (order.canReceiveAtShop || order.status === 'in_transit_to_shop') {
    return `/orders/${order._id}/receiving`;
  }
  if (isPartnerLaundryProcessingStatus(order.status) || order.status === 'received_at_shop') {
    return `/orders/${order._id}`;
  }
  return `/orders/${order._id}`;
}
