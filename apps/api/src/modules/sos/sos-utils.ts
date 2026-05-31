import { OrderStatus } from '@lunara/types';

export const ACTIVE_SOS_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.RIDER_ASSIGNED_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
];

export function isActiveSosOrderStatus(status: string): boolean {
  return ACTIVE_SOS_ORDER_STATUSES.includes(status as OrderStatus);
}

export function buildMapsUrl(lat?: number, lng?: number): string | undefined {
  if (lat === undefined || lng === undefined) return undefined;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export function buildSosAlertPayload(input: {
  incidentId: string;
  orderId: string;
  riderUserId: string;
  riderName: string;
  lat?: number;
  lng?: number;
}) {
  const mapsUrl = buildMapsUrl(input.lat, input.lng);
  return {
    type: 'rider_sos',
    orderId: input.orderId,
    incidentId: input.incidentId,
    riderUserId: input.riderUserId,
    riderName: input.riderName,
    message: 'Rider SOS — immediate assistance requested',
    lat: input.lat,
    lng: input.lng,
    mapsUrl,
    at: new Date().toISOString(),
  };
}
