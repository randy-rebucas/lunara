import { distanceKm as haversineKm, resolveCoordinates } from './branch.js';

export interface RiderSuggestInput {
  userId: string;
  email?: string;
  isOnline: boolean;
  activePickupTasks: number;
  activeDeliveryTasks: number;
  completedPickups30d: number;
  riderLat?: number;
  riderLng?: number;
}

export interface RiderPickupSuggestion {
  userId: string;
  email?: string;
  isOnline: boolean;
  distanceKm: number | null;
  distanceLabel: string;
  activeTasks: number;
  performanceLabel: string;
  availabilityLabel: string;
  recommendationScore: number;
  rank: number;
  isRecommended: boolean;
}

export function scoreRiderForPickup(
  rider: RiderSuggestInput,
  customerCity: string,
  customerLat?: number,
  customerLng?: number,
): Omit<RiderPickupSuggestion, 'rank' | 'isRecommended'> {
  const customerCoords = resolveCoordinates(customerCity, customerLat, customerLng);
  let distanceKm: number | null = null;
  if (rider.riderLat != null && rider.riderLng != null) {
    distanceKm =
      Math.round(haversineKm(customerCoords, [rider.riderLng, rider.riderLat]) * 10) / 10;
  }

  const distanceScore =
    distanceKm == null ? 50 : Math.max(0, 100 - (distanceKm / 15) * 100);
  const loadScore = Math.max(0, 100 - rider.activePickupTasks * 25 - rider.activeDeliveryTasks * 15);
  const perfScore = Math.min(100, 40 + rider.completedPickups30d * 3);
  const onlineScore = rider.isOnline ? 100 : 0;

  const recommendationScore = Math.round(
    distanceScore * 0.35 + loadScore * 0.3 + perfScore * 0.2 + onlineScore * 0.15,
  );

  let availabilityLabel = rider.isOnline ? 'Online' : 'Offline';
  if (rider.activePickupTasks > 0) {
    availabilityLabel = `${rider.activePickupTasks} active pickup(s)`;
  }

  return {
    userId: rider.userId,
    email: rider.email,
    isOnline: rider.isOnline,
    distanceKm,
    distanceLabel: distanceKm != null ? `${distanceKm} km` : 'Location unknown',
    activeTasks: rider.activePickupTasks + rider.activeDeliveryTasks,
    performanceLabel:
      rider.completedPickups30d >= 10
        ? 'Experienced'
        : rider.completedPickups30d >= 3
          ? 'Active'
          : 'New',
    availabilityLabel,
    recommendationScore,
  };
}

export function rankRidersForPickup(
  riders: RiderSuggestInput[],
  customerCity: string,
  customerLat?: number,
  customerLng?: number,
): RiderPickupSuggestion[] {
  const scored = riders
    .map((r) => scoreRiderForPickup(r, customerCity, customerLat, customerLng))
    .sort((a, b) => b.recommendationScore - a.recommendationScore);

  return scored.map((s, i) => ({
    ...s,
    rank: i + 1,
    isRecommended: i === 0 && s.isOnline,
  }));
}

/** Delivery assignment — prioritize lower delivery load. */
export function scoreRiderForDelivery(
  rider: RiderSuggestInput,
  customerCity: string,
  customerLat?: number,
  customerLng?: number,
): Omit<RiderPickupSuggestion, 'rank' | 'isRecommended'> {
  const base = scoreRiderForPickup(rider, customerCity, customerLat, customerLng);
  const loadScore = Math.max(0, 100 - rider.activeDeliveryTasks * 30 - rider.activePickupTasks * 10);
  const recommendationScore = Math.round(base.recommendationScore * 0.7 + loadScore * 0.3);
  return { ...base, recommendationScore };
}

export function rankRidersForDelivery(
  riders: RiderSuggestInput[],
  customerCity: string,
  customerLat?: number,
  customerLng?: number,
): RiderPickupSuggestion[] {
  const scored = riders
    .map((r) => scoreRiderForDelivery(r, customerCity, customerLat, customerLng))
    .sort((a, b) => b.recommendationScore - a.recommendationScore);

  return scored.map((s, i) => ({
    ...s,
    rank: i + 1,
    isRecommended: i === 0 && s.isOnline,
  }));
}
