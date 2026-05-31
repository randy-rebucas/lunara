'use client';

import Link from 'next/link';
import { adminFetch } from '../lib/admin-api';
import type { DispatcherAlert, SosLocationUpdate } from '../lib/use-admin-operations-socket';

export interface ActiveSosIncident {
  incidentId: string;
  orderId: string;
  riderUserId: string;
  riderName: string;
  dispatchNotifiedAt?: string;
  locationSharingStartedAt?: string;
  locationSharingActive: boolean;
  lastLocation?: {
    lat: number;
    lng: number;
    recordedAt: string;
  } | null;
  updatedAt?: string;
}

export function mapsUrl(lat?: number, lng?: number) {
  if (lat === undefined || lng === undefined) return undefined;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export async function fetchActiveSosIncidents() {
  const res = await adminFetch<ActiveSosIncident[]>('/admin/sos/active');
  return res;
}

export async function resolveSosIncident(incidentId: string) {
  await adminFetch(`/admin/sos/${incidentId}/resolve`, { method: 'PATCH' });
}

interface SosIncidentBannerProps {
  incidents: ActiveSosIncident[];
  liveAlert?: DispatcherAlert | null;
  liveLocations: Record<string, SosLocationUpdate>;
  resolvingId?: string | null;
  resolveError?: string;
  onResolve: (incidentId: string) => void;
  onDismissAlert?: () => void;
}

export function SosIncidentBanner({
  incidents,
  liveAlert,
  liveLocations,
  resolvingId,
  resolveError,
  onResolve,
  onDismissAlert,
}: SosIncidentBannerProps) {
  const merged = [...incidents];
  if (
    liveAlert?.type === 'rider_sos' &&
    liveAlert.incidentId &&
    !merged.some((i) => i.incidentId === liveAlert.incidentId)
  ) {
    merged.unshift({
      incidentId: liveAlert.incidentId,
      orderId: liveAlert.orderId ?? '',
      riderUserId: liveAlert.riderUserId ?? '',
      riderName: liveAlert.riderName ?? 'Rider',
      locationSharingActive: false,
      lastLocation:
        liveAlert.lat !== undefined && liveAlert.lng !== undefined
          ? { lat: liveAlert.lat, lng: liveAlert.lng, recordedAt: liveAlert.at ?? new Date().toISOString() }
          : null,
    });
  }

  if (merged.length === 0 && liveAlert?.type !== 'rider_sos') return null;

  return (
    <div className="space-y-3" role="alert" aria-live="assertive">
      {resolveError ? (
        <div className="alert-error text-sm">{resolveError}</div>
      ) : null}
      {merged.map((incident) => {
        const live = liveLocations[incident.incidentId];
        const lat = live?.lat ?? incident.lastLocation?.lat;
        const lng = live?.lng ?? incident.lastLocation?.lng;
        const mapLink = live?.mapsUrl ?? mapsUrl(lat, lng);

        return (
          <div
            key={incident.incidentId}
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Rider SOS — {incident.riderName}</p>
                <p className="mt-1">
                  Immediate assistance requested
                  {incident.orderId ? (
                    <>
                      {' '}
                      ·{' '}
                      <Link href={`/orders/${incident.orderId}`} className="font-medium underline">
                        Order {incident.orderId.slice(-6)}
                      </Link>
                    </>
                  ) : null}
                </p>
                {incident.locationSharingActive || live ? (
                  <p className="mt-2 text-red-800">
                    Live location:{' '}
                    {lat !== undefined && lng !== undefined
                      ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                      : 'Waiting for GPS…'}
                    {mapLink ? (
                      <>
                        {' '}
                        ·{' '}
                        <a href={mapLink} target="_blank" rel="noreferrer" className="underline">
                          Open in Maps
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-2 text-red-800">Location sharing not active</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  disabled={resolvingId === incident.incidentId}
                  onClick={() => onResolve(incident.incidentId)}
                >
                  {resolvingId === incident.incidentId ? 'Resolving…' : 'Acknowledge'}
                </button>
                {liveAlert?.incidentId === incident.incidentId && onDismissAlert ? (
                  <button type="button" className="text-xs font-medium underline" onClick={onDismissAlert}>
                    Dismiss banner
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
