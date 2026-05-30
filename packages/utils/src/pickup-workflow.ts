import { OrderStatus } from '@lunara/types';

/** Rider pickup workflow after assignment. */
export const PICKUP_WORKFLOW_STEPS = [
  { id: 'accept', label: 'Rider accepts', status: OrderStatus.RIDER_ASSIGNED_PICKUP },
  { id: 'navigate', label: 'Navigate to customer', status: OrderStatus.RIDER_ASSIGNED_PICKUP },
  { id: 'pickup', label: 'Pickup laundry', status: OrderStatus.PICKED_UP },
  { id: 'photo', label: 'Take photo', status: OrderStatus.PICKED_UP },
  { id: 'receipt', label: 'Generate pickup receipt', status: OrderStatus.PICKED_UP },
  { id: 'deliver_shop', label: 'Deliver to assigned shop', status: OrderStatus.IN_TRANSIT_TO_SHOP },
] as const;

export interface PickupProgressInput {
  status: string;
  pickup?: {
    acceptedAt?: string | Date;
    arrivedAt?: string | Date;
    customerVerifiedAt?: string | Date;
    collectedAt?: string | Date;
    photoUrl?: string;
    receiptCode?: string;
    droppedAtShop?: string | Date;
  };
}

export function getPickupWorkflowStepIndex(input: PickupProgressInput): number {
  const p = input.pickup ?? {};
  if (
    input.status === OrderStatus.IN_TRANSIT_TO_SHOP ||
    input.status === OrderStatus.RECEIVED_AT_SHOP ||
    input.status === OrderStatus.RECEIVED ||
    p.droppedAtShop
  ) {
    return 5;
  }
  if (p.receiptCode) return 4;
  if (p.photoUrl) return 3;
  if (p.collectedAt || input.status === OrderStatus.PICKED_UP) return 2;
  if (p.arrivedAt || p.customerVerifiedAt) return 1;
  if (p.acceptedAt || input.status === OrderStatus.RIDER_ASSIGNED_PICKUP) return 0;
  return 0;
}

export function getPickupWorkflowLabel(input: PickupProgressInput): string {
  const idx = getPickupWorkflowStepIndex(input);
  return PICKUP_WORKFLOW_STEPS[idx]?.label ?? 'Pickup';
}
