'use client';

import { APIProvider, Map, Marker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface BranchAddressValue {
  line1: string;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
}

interface BranchAddressEditorProps {
  value: BranchAddressValue;
  onChange: (value: BranchAddressValue) => void;
  /** Change this when a different record's address is loaded in (e.g. switching branches) so
   * the map recenters to the newly loaded marker instead of staying wherever it was left. */
  resetKey?: string | number;
}

/** Extracts line1/city/province from a Google Place's address_components. */
function placeToAddress(place: google.maps.places.Place): Partial<BranchAddressValue> {
  const components = place.addressComponents ?? [];
  const get = (type: string) =>
    components.find((c) => c.types.includes(type))?.longText ?? '';

  const streetNumber = get('street_number');
  const route = get('route');
  const line1 = [streetNumber, route].filter(Boolean).join(' ') || get('sublocality') || get('neighborhood');
  const city = get('locality') || get('administrative_area_level_2');
  const province = get('administrative_area_level_1');

  const result: Partial<BranchAddressValue> = {};
  if (line1) result.line1 = line1;
  if (city) result.city = city;
  if (province) result.province = province;
  if (place.location) {
    result.latitude = place.location.lat();
    result.longitude = place.location.lng();
  }
  return result;
}

/**
 * Wraps the new `google.maps.places.PlaceAutocompleteElement` custom element — there's no
 * first-class React wrapper for it yet in @vis.gl/react-google-maps, so we mount the vanilla
 * web component ourselves and bridge its `gmp-select` event into React state.
 */
function PlaceAutocompleteInput({ onPlaceSelected }: { onPlaceSelected: (place: google.maps.places.Place) => void }) {
  const placesLib = useMapsLibrary('places');
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  // Mounting the vanilla element is expensive and steals focus, so the mount effect below must
  // only depend on `placesLib` (stable once loaded) — not on this callback, which is a new
  // closure every render of the parent form as the partner types into the other address fields.
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onPlaceSelected]);

  useEffect(() => {
    if (!placesLib || !containerRef.current) return;
    const container = containerRef.current;

    const element = new placesLib.PlaceAutocompleteElement({
      includedRegionCodes: ['ph'],
    });
    element.classList.add('w-full');
    elementRef.current = element;
    container.innerHTML = '';
    container.appendChild(element);

    async function handleSelect(event: Event) {
      const { placePrediction } = event as unknown as {
        placePrediction: google.maps.places.PlacePrediction;
      };
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ['addressComponents', 'location', 'formattedAddress'],
      });
      onPlaceSelectedRef.current(place);
    }

    element.addEventListener('gmp-select', handleSelect);
    return () => {
      element.removeEventListener('gmp-select', handleSelect);
      container.innerHTML = '';
    };
  }, [placesLib]);

  return (
    <div
      ref={containerRef}
      className="rounded-lg bg-surface ring-1 ring-border/60 transition-shadow focus-within:ring-2 focus-within:ring-primary/25 [&_gmp-place-autocomplete]:w-full"
    />
  );
}

function MapPicker({
  value,
  recenterToken,
  onPositionChange,
}: {
  value: BranchAddressValue;
  /** Changes only when the position changed via search or a different record loaded in (not
   * drag/click) to force a recenter. */
  recenterToken: string;
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const position = { lat: value.latitude, lng: value.longitude };
  return (
    // `center` is deliberately NOT a continuously-controlled prop here — only `key` forces a
    // recenter (on search selection, via recenterToken). Otherwise any unrelated re-render (e.g.
    // typing in another field) would snap the map back to `position` mid-drag, making it
    // impossible to pan.
    <Map
      key={recenterToken}
      defaultCenter={position}
      defaultZoom={15}
      gestureHandling="greedy"
      disableDefaultUI={false}
      style={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}
      onClick={(e) => {
        if (e.detail.latLng) onPositionChange(e.detail.latLng.lat, e.detail.latLng.lng);
      }}
    >
      <Marker
        position={position}
        draggable
        onDragEnd={(e) => {
          const pos = e.latLng;
          if (pos) onPositionChange(pos.lat(), pos.lng());
        }}
      />
    </Map>
  );
}

export function BranchAddressEditor({ value, onChange, resetKey }: BranchAddressEditorProps) {
  const [recenterToken, setRecenterToken] = useState(0);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Map picker is not configured for this environment.
      </p>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'marker']}>
      <div className="grid gap-3">
        <div>
          <label className="form-label">Search address</label>
          <PlaceAutocompleteInput
            onPlaceSelected={(place) => {
              const patch = placeToAddress(place);
              onChange({ ...value, ...patch });
              if (patch.latitude != null && patch.longitude != null) {
                setRecenterToken((t) => t + 1);
              }
            }}
          />
          <p className="mt-1 text-xs text-muted">
            Search to auto-fill the fields below, or drag the pin / click the map to fine-tune.
          </p>
        </div>

        <div>
          <label className="form-label">Street address</label>
          <input
            className="input-field"
            value={value.line1}
            onChange={(e) => onChange({ ...value, line1: e.target.value })}
            placeholder="e.g. 123 Ayala Ave"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">City</label>
            <input
              className="input-field"
              value={value.city}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Province</label>
            <input
              className="input-field"
              value={value.province}
              onChange={(e) => onChange({ ...value, province: e.target.value })}
            />
          </div>
        </div>

        <div className="h-56">
          <MapPicker
            value={value}
            recenterToken={`${resetKey ?? 'default'}-${recenterToken}`}
            onPositionChange={(latitude, longitude) => onChange({ ...value, latitude, longitude })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Latitude</label>
            <input
              className="input-field bg-slate-50 text-muted"
              value={value.latitude.toFixed(6)}
              readOnly
              title="Set by searching an address or moving the pin on the map above"
            />
          </div>
          <div>
            <label className="form-label">Longitude</label>
            <input
              className="input-field bg-slate-50 text-muted"
              value={value.longitude.toFixed(6)}
              readOnly
              title="Set by searching an address or moving the pin on the map above"
            />
          </div>
        </div>
      </div>
    </APIProvider>
  );
}
