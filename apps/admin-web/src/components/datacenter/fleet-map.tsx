'use client';

/**
 * Shared Google-Maps fleet view: rider + laundry-shop pins with fit-once framing.
 * Used by the live-tracking page and the control tower.
 */

import { APIProvider, AdvancedMarker, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export const LEG_COLORS: Record<string, string> = {
  idle: '#22c55e',
  pickup: '#4f46e5',
  delivery: '#f97316',
};

export interface FleetMapRider {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  color: string;
  title?: string;
}

export interface FleetMapBranch {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
}

function FitOnce({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!map || fitted.current || points.length === 0) return;
    fitted.current = true;
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 56);
  }, [map, points]);

  return null;
}

function RiderPin({ color, selected }: { color: string; selected: boolean }) {
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-md transition-transform ${
        selected ? 'scale-125 ring-2 ring-offset-1' : ''
      }`}
      style={{ backgroundColor: color }}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    </span>
  );
}

function ShopPin() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-white bg-slate-700 text-white shadow-md">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17"
        />
      </svg>
    </span>
  );
}

export function MapLegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

export function FleetMapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <MapLegendChip color={LEG_COLORS.idle} label="Idle rider" />
      <MapLegendChip color={LEG_COLORS.pickup} label="Pickup leg" />
      <MapLegendChip color={LEG_COLORS.delivery} label="Delivery leg" />
      <MapLegendChip color="#334155" label="Laundry shop" />
    </div>
  );
}

export function FleetMap({
  riders,
  branches,
  selectedRiderId,
  onSelectRider,
  heightClass = 'h-[26rem]',
}: {
  riders: FleetMapRider[];
  branches: FleetMapBranch[];
  selectedRiderId?: string | null;
  onSelectRider?: (userId: string) => void;
  heightClass?: string;
}) {
  const fitPoints = [
    ...riders.map((r) => ({ lat: r.lat, lng: r.lng })),
    ...branches.map((b) => ({ lat: b.lat, lng: b.lng })),
  ];
  const mapCenter = fitPoints[0] ?? { lat: 14.5995, lng: 120.9842 };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="px-5 py-6">
        <p className="text-sm text-muted">
          Map unavailable — set <span className="text-code">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</span> to render the fleet
          map. Rider positions:
        </p>
        {riders.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No riders reporting GPS fixes right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {riders.map((r) => (
              <li key={r.userId} className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: r.color }}
                  aria-hidden
                />
                <span className="font-medium text-slate-900">{r.name}</span>
                <a
                  className="link-primary text-xs font-medium"
                  href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={heightClass}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapId="lunara-admin-fleet"
          defaultCenter={mapCenter}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="h-full w-full"
        >
          <FitOnce points={fitPoints} />
          {branches.map((b) => (
            <AdvancedMarker key={b.id} position={{ lat: b.lat, lng: b.lng }} title={`${b.name} (${b.code})`}>
              <ShopPin />
            </AdvancedMarker>
          ))}
          {riders.map((r) => (
            <AdvancedMarker
              key={r.userId}
              position={{ lat: r.lat, lng: r.lng }}
              title={r.title ?? r.name}
              onClick={onSelectRider ? () => onSelectRider(r.userId) : undefined}
            >
              <RiderPin color={r.color} selected={selectedRiderId === r.userId} />
            </AdvancedMarker>
          ))}
        </GoogleMap>
      </APIProvider>
    </div>
  );
}
