import { OrderStatus } from '@lunara/types';

/** Partner shop intake after rider delivery. */
export const SHOP_RECEIVING_STEPS = [
  { id: 'shop', label: 'Laundry shop', status: OrderStatus.IN_TRANSIT_TO_SHOP },
  { id: 'receive', label: 'Receive laundry', status: OrderStatus.IN_TRANSIT_TO_SHOP },
  { id: 'verify_weight', label: 'Verify weight', status: OrderStatus.IN_TRANSIT_TO_SHOP },
  { id: 'confirm_items', label: 'Confirm items', status: OrderStatus.RECEIVED_AT_SHOP },
] as const;

export interface ShopReceivingProgressInput {
  status: string;
  shopReceiving?: {
    receivedAt?: string | Date;
    verifiedWeightKg?: number;
    weightVerifiedAt?: string | Date;
    itemsConfirmedAt?: string | Date;
    itemCount?: number;
    notes?: string;
  };
}

export function getShopReceivingStepIndex(input: ShopReceivingProgressInput): number {
  const r = input.shopReceiving ?? {};
  if (
    input.status === OrderStatus.RECEIVED_AT_SHOP ||
    input.status === OrderStatus.RECEIVED ||
    r.itemsConfirmedAt
  ) {
    return 3;
  }
  if (r.weightVerifiedAt || r.verifiedWeightKg != null) return 2;
  if (r.receivedAt) return 1;
  if (
    input.status === OrderStatus.IN_TRANSIT_TO_SHOP ||
    input.status === OrderStatus.PICKED_UP
  ) {
    return 0;
  }
  return 0;
}

export function getShopReceivingLabel(input: ShopReceivingProgressInput): string {
  const idx = getShopReceivingStepIndex(input);
  return SHOP_RECEIVING_STEPS[idx]?.label ?? 'Shop receiving';
}
