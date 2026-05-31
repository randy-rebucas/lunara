import type { DeliveryOffer, PickupOffer, Task } from './rider-types';

export function getRouteProgressIndex(
  online: boolean,
  offers: PickupOffer[],
  deliveryOffers: DeliveryOffer[],
  tasks: Task[],
): number {
  if (tasks.length > 0) return 4;
  if (offers.length > 0 || deliveryOffers.length > 0) return 3;
  if (online) return 2;
  return 1;
}
