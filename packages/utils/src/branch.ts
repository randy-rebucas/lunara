/** Approximate city centroids for Metro Manila (lng, lat). */
export const CITY_COORDINATES: Record<string, [number, number]> = {
  makati: [121.0244, 14.5547],
  'quezon city': [121.0437, 14.676],
  quezon: [121.0437, 14.676],
  manila: [120.9842, 14.5995],
  taguig: [121.0509, 14.5176],
  bgc: [121.0509, 14.5176],
  pasig: [121.0851, 14.5764],
  mandaluyong: [121.0365, 14.5794],
  pasay: [121.0, 14.5378],
  paranaque: [121.0198, 14.4793],
  default: [121.0244, 14.5547],
};

export function resolveCoordinates(
  city: string,
  latitude?: number,
  longitude?: number,
): [number, number] {
  if (latitude != null && longitude != null) {
    return [longitude, latitude];
  }
  const key = city.trim().toLowerCase();
  return CITY_COORDINATES[key] ?? CITY_COORDINATES.default;
}

/** Haversine distance in km between two [lng, lat] points. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Managed laundry network — admin dispatches to partner branches. */
export const MANAGED_NETWORK_FLOW = [
  { id: 'booked', label: 'Customer books on Lunara' },
  { id: 'order_created', label: 'Order created (pending payment)' },
  { id: 'pending_dispatch', label: 'Pending dispatch (paid)' },
  { id: 'platform', label: 'Lunara platform (payment)' },
  { id: 'dispatcher', label: 'Admin dispatcher assigns branch' },
  { id: 'partner', label: 'Partner laundry shop processes' },
  { id: 'rider', label: 'Rider pickup & delivery' },
] as const;

/** @deprecated Use MANAGED_NETWORK_FLOW — marketplace auto-assign removed */
export const BRANCH_ASSIGNMENT_FLOW = MANAGED_NETWORK_FLOW;
