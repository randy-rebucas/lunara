import { OrderStatus } from '@lunara/types';

/** Rider + customer delivery after `rider_assigned_delivery`. */
export const DELIVERY_WORKFLOW_STEPS = [
  { id: 'pickup_shop', label: 'Rider pickup from shop', status: OrderStatus.RIDER_ASSIGNED_DELIVERY },
  { id: 'out_for_delivery', label: 'Out for delivery', status: OrderStatus.OUT_FOR_DELIVERY },
  { id: 'customer_receives', label: 'Customer receives', status: OrderStatus.OUT_FOR_DELIVERY },
  { id: 'photo_proof', label: 'Photo proof', status: OrderStatus.OUT_FOR_DELIVERY },
  { id: 'signature', label: 'Signature', status: OrderStatus.OUT_FOR_DELIVERY },
  { id: 'completed', label: 'Completed', status: OrderStatus.COMPLETED },
] as const;

export interface DeliveryProgressInput {
  status: string;
  delivery?: {
    acceptedAt?: string | Date;
    pickedUpFromShopAt?: string | Date;
    startedAt?: string | Date;
    customerReceivedAt?: string | Date;
    customerVerifiedAt?: string | Date;
    arrivedAt?: string | Date;
    photoUrl?: string;
    customerSignedAt?: string | Date;
    deliveredAt?: string | Date;
  };
}

export function getDeliveryWorkflowStepIndex(input: DeliveryProgressInput): number {
  const d = input.delivery ?? {};
  if (
    input.status === OrderStatus.COMPLETED ||
    input.status === OrderStatus.DELIVERED ||
    d.deliveredAt
  ) {
    return 5;
  }
  if (d.customerSignedAt) return 4;
  if (d.photoUrl) return 3;
  if (d.customerReceivedAt || d.customerVerifiedAt || d.arrivedAt) return 2;
  if (d.startedAt || input.status === OrderStatus.OUT_FOR_DELIVERY) return 1;
  if (d.pickedUpFromShopAt) return 1;
  if (d.acceptedAt || input.status === OrderStatus.RIDER_ASSIGNED_DELIVERY) return 0;
  return 0;
}

export function getDeliveryWorkflowLabel(input: DeliveryProgressInput): string {
  const idx = getDeliveryWorkflowStepIndex(input);
  return DELIVERY_WORKFLOW_STEPS[idx]?.label ?? 'Delivery';
}
