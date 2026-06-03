import type { PartnerProcessingView } from '@lunara/types';
import { isPartnerLaundryProcessingStatus } from '@lunara/utils';

export type PartnerOrderDetailView = PartnerProcessingView & { preProcessing?: boolean };

export function isOrderPreProcessingPhase(view: PartnerOrderDetailView): boolean {
  return view.preProcessing === true || !isPartnerLaundryProcessingStatus(view.order.status);
}

export function orderDetailBackHref(partner: boolean): string {
  return partner ? '/orders/incoming' : '/orders';
}
