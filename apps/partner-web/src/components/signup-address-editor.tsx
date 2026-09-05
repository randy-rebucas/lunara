'use client';

import { APIProvider, Map, Marker, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface SignupAddressValue {
  line1: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

interface SignupAddressEditorProps {
  value: SignupAddressValue;
  onChange: (value: SignupAddressValue) => void;
}

/** Extracts line1/city/province/postalCode from a Google Place's address_components — same
 * pattern as branch-address-editor.tsx, extended with postal_code for the signup wizard. */
function placeToAddress(place: google.maps.places.Place): Partial<SignupAddressValue> {
  const components = place.addressComponents ?? [];
  const get = (type: string) => components.find((c) => c.types.includes(type))?.longText ?? '';

  const streetNumber = get('street_number');
  const route = get('route');
  const line1 = [streetNumber, route].filter(Boolean).join(' ') || get('sublocality') || get('neighborhood');
  const city = get('locality') || get('administrative_area_level_2');
  const province = get('administrative_area_level_1');
  const postalCode = get('postal_code');

  const result: Partial<SignupAddressValue> = {};
  if (line1) result.line1 = line1;
  if (city) result.city = city;
  if (province) result.province = province;
  if (postalCode) result.postalCode = postalCode;
  if (place.location) {
    result.latitude = place.location.lat();
    result.longitude = place.location.lng();
  }
  return result;
}

/** Wraps the vanilla `google.maps.places.PlaceAutocompleteElement` custom element — same
 * approach as branch-address-editor.tsx's PlaceAutocompleteInput. */
function PlaceAutocompleteInput({ onPlaceSelected }: { onPlaceSelected: (place: google.maps.places.Place) => void }) {
  const placesLib = useMapsLibrary('places');
  const containerRef = useRef<HTMLDivElement>(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  useEffect(() => {
    onPlaceSelectedRef.current = onPlaceSelected;
  }, [onPlaceSelected]);

  useEffect(() => {
    if (!placesLib || !containerRef.current) return;
    const container = containerRef.current;

    const element = new placesLib.PlaceAutocompleteElement({ includedRegionCodes: ['ph'] });
    element.classList.add('w-full');
    container.innerHTML = '';
    container.appendChild(element);

    async function handleSelect(event: Event) {
      const { placePrediction } = event as unknown as {
        placePrediction: google.maps.places.PlacePrediction;
      };
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['addressComponents', 'location', 'formattedAddress'] });
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
  value: SignupAddressValue;
  recenterToken: string;
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const position = { lat: value.latitude, lng: value.longitude };
  return (
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

export function SignupAddressEditor({ value, onChange }: SignupAddressEditorProps) {
  const [recenterToken, setRecenterToken] = useState(0);
  const hasPin = value.latitude !== 0 || value.longitude !== 0;

  return (
    <div className="grid gap-3">
      {GOOGLE_MAPS_API_KEY ? (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'marker']}>
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
          {hasPin && (
            <div className="h-48">
              <MapPicker
                value={value}
                recenterToken={String(recenterToken)}
                onPositionChange={(latitude, longitude) => onChange({ ...value, latitude, longitude })}
              />
            </div>
          )}
        </APIProvider>
      ) : (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Map search is not configured for this environment — fill in the fields manually below.
        </p>
      )}

      <div>
        <label className="form-label">Street address</label>
        <input
          className="input-field"
          value={value.line1}
          onChange={(e) => onChange({ ...value, line1: e.target.value })}
          placeholder="e.g. 123 Ayala Ave"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">City / Municipality</label>
          <input
            className="input-field"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="form-label">Province</label>
          <input
            className="input-field"
            value={value.province}
            onChange={(e) => onChange({ ...value, province: e.target.value })}
            required
          />
        </div>
      </div>
      <div>
        <label className="form-label">Postal / ZIP code</label>
        <input
          className="input-field max-w-[160px]"
          value={value.postalCode}
          onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
        />
      </div>
    </div>
  );
}
