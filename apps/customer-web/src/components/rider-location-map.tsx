'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';

/** Resolves the live --color-primary token so the map matches white-label tenant branding
 * instead of a hardcoded royal blue — Leaflet icons/paths need a literal color string, not a CSS var. */
function resolvePrimaryColor() {
  if (typeof window === 'undefined') return '#2563eb';
  const value = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  return value || '#2563eb';
}

function buildRiderIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const destinationIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#16a34a;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length < 2) return;
    map.fitBounds(
      points.map((p) => [p.lat, p.lng]),
      { padding: [32, 32] },
    );
    fitted.current = true;
  }, [map, points]);
  return null;
}

function RiderMarker({
  position,
  icon,
}: {
  position: { lat: number; lng: number };
  icon: L.DivIcon;
}) {
  const map = useMap();
  const hasCentered = useRef(false);
  useEffect(() => {
    if (!hasCentered.current) {
      map.setView([position.lat, position.lng]);
      hasCentered.current = true;
    }
  }, [map, position]);
  return <Marker position={[position.lat, position.lng]} icon={icon} />;
}

interface RiderLocationMapProps {
  lat: number;
  lng: number;
  destinationLat?: number;
  destinationLng?: number;
}

export function RiderLocationMap({ lat, lng, destinationLat, destinationLng }: RiderLocationMapProps) {
  const rider = { lat, lng };
  const hasDestination = destinationLat != null && destinationLng != null;
  const destination = hasDestination ? { lat: destinationLat, lng: destinationLng } : null;
  const distanceKm = destination ? haversineKm(rider, destination) : null;
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const primaryColor = useMemo(() => resolvePrimaryColor(), []);
  const riderIcon = useMemo(() => buildRiderIcon(primaryColor), [primaryColor]);

  return (
    <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border/50">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        className="h-56 w-full"
        style={{ background: '#e2e8f0' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RiderMarker position={rider} icon={riderIcon} />
        {destination && <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} />}
        {destination && (
          <Polyline
            positions={[
              [rider.lat, rider.lng],
              [destination.lat, destination.lng],
            ]}
            pathOptions={{ color: primaryColor, weight: 2, dashArray: '6 6', opacity: 0.6 }}
          />
        )}
        {destination && <FitBounds points={[rider, destination]} />}
      </MapContainer>
      <div className="flex items-center justify-between gap-3 bg-surface px-4 py-3 text-sm">
        <span className="min-w-0 truncate text-muted">
          Live rider location
          {distanceKm != null ? ` · ${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away` : ''}
        </span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-medium text-primary hover:text-primary/80"
        >
          Open in Maps →
        </a>
      </div>
    </div>
  );
}
