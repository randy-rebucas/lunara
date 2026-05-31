import * as Location from 'expo-location';

export interface GeocodedAddressFields {
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
}

const PH_POSTAL_RE = /\b(\d{4})\b/;

function extractPhilippinePostalCode(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = value?.trim();
    if (!text) continue;
    if (/^\d{4}$/.test(text)) return text;
    const match = text.match(PH_POSTAL_RE);
    if (match?.[1]) return match[1];
  }
  return '';
}

function pickPostalFromPlace(place: Location.LocationGeocodedAddress): string {
  return extractPhilippinePostalCode(
    place.postalCode,
    place.formattedAddress,
    place.name,
    place.district,
    place.subregion,
    place.region,
    place.street,
  );
}

function pickPostalFromResults(results: Location.LocationGeocodedAddress[]): string {
  for (const place of results) {
    const postalCode = pickPostalFromPlace(place);
    if (postalCode) return postalCode;
  }
  return '';
}

async function fetchPostalCodeFromNominatim(latitude: number, longitude: number): Promise<string> {
  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'json',
      addressdetails: '1',
      zoom: '18',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LunaraCustomerMobile/1.0 (address lookup)',
      },
    });
    if (!res.ok) return '';

    const data = (await res.json()) as {
      address?: { postcode?: string };
      display_name?: string;
    };

    return extractPhilippinePostalCode(data.address?.postcode, data.display_name);
  } catch {
    return '';
  }
}

/** Map expo reverse-geocode result to Lunara address fields (PH-friendly). */
export function mapGeocodeToAddress(
  results: Location.LocationGeocodedAddress[],
): GeocodedAddressFields | null {
  const place = results[0];
  if (!place) return null;

  const streetParts = [place.streetNumber, place.street].filter(Boolean);
  let line1 = streetParts.join(' ').trim();

  if (!line1 && place.name && place.name !== place.street) {
    line1 = place.name;
  }
  if (!line1 && place.district) {
    line1 = place.district;
  }

  const city = (place.city || place.subregion || place.district || '').trim();
  const province = (place.region || place.subregion || '').trim();
  const postalCode = pickPostalFromResults(results);

  const line2 =
    place.name && line1 && place.name !== line1 && !line1.includes(place.name)
      ? place.name
      : '';

  if (!line1 && !city && !province) return null;

  return {
    line1,
    line2,
    city,
    province,
    postalCode,
  };
}

/** Reverse geocode coords into address fields, with postal code fallbacks for PH. */
export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<GeocodedAddressFields | null> {
  let results: Location.LocationGeocodedAddress[] = [];
  try {
    results = await Location.reverseGeocodeAsync({ latitude, longitude });
  } catch {
    results = [];
  }

  const mapped = results.length ? mapGeocodeToAddress(results) : null;
  let postalCode = mapped?.postalCode ?? pickPostalFromResults(results);

  if (!postalCode) {
    postalCode = await fetchPostalCodeFromNominatim(latitude, longitude);
  }

  if (!mapped) return null;

  return {
    ...mapped,
    postalCode: postalCode || mapped.postalCode,
  };
}
