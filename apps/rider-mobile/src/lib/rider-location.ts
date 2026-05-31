import type { LocationObject } from 'expo-location';
import type { RiderLocationPayload } from '@lunara/utils';

export function buildLocationPayload(loc: LocationObject): RiderLocationPayload {
  const payload: RiderLocationPayload = {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    timestamp: loc.timestamp ? new Date(loc.timestamp).toISOString() : new Date().toISOString(),
  };

  if (loc.coords.speed != null && loc.coords.speed >= 0) {
    payload.speed = loc.coords.speed;
  }
  if (loc.coords.heading != null && loc.coords.heading >= 0) {
    payload.heading = loc.coords.heading;
  }

  return payload;
}

export function locationSocketPayload(
  payload: RiderLocationPayload,
  orderId: string,
  riderId: string,
) {
  return {
    orderId,
    riderId,
    lat: payload.latitude,
    lng: payload.longitude,
    latitude: payload.latitude,
    longitude: payload.longitude,
    speed: payload.speed,
    heading: payload.heading,
    timestamp: payload.timestamp,
  };
}

export function locationPatchBody(payload: RiderLocationPayload) {
  return {
    lat: payload.latitude,
    lng: payload.longitude,
    latitude: payload.latitude,
    longitude: payload.longitude,
    speed: payload.speed,
    heading: payload.heading,
    timestamp: payload.timestamp,
  };
}
