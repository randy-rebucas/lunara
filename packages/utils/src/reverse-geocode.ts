export interface GeocodedAddressFields {
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
}

const PH_POSTAL_RE = /\b(\d{4})\b/;
const NOMINATIM_USER_AGENT = 'LunaraCustomer/1.0 (address lookup)';

export function extractPhilippinePostalCode(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = value?.trim();
    if (!text) continue;
    if (/^\d{4}$/.test(text)) return text;
    const match = text.match(PH_POSTAL_RE);
    if (match?.[1]) return match[1];
  }
  return '';
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  street?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
  state?: string;
  region?: string;
  postcode?: string;
}

interface NominatimReverseResponse {
  display_name?: string;
  address?: NominatimAddress;
}

function mapNominatimToAddress(data: NominatimReverseResponse): GeocodedAddressFields | null {
  const addr = data.address;
  if (!addr && !data.display_name) return null;

  const streetParts = [addr?.house_number, addr?.road ?? addr?.street].filter(Boolean);
  let line1 = streetParts.join(' ').trim();

  if (!line1 && addr?.neighbourhood) line1 = addr.neighbourhood;
  if (!line1 && data.display_name) {
    line1 = data.display_name.split(',')[0]?.trim() ?? '';
  }

  const city = (
    addr?.city ||
    addr?.town ||
    addr?.municipality ||
    addr?.suburb ||
    addr?.county ||
    ''
  ).trim();

  const province = (addr?.state || addr?.region || '').trim();
  const postalCode = extractPhilippinePostalCode(addr?.postcode, data.display_name);

  const line2 =
    addr?.suburb && line1 && !line1.includes(addr.suburb) ? addr.suburb.trim() : '';

  if (!line1 && !city && !province) return null;

  return {
    line1,
    line2,
    city,
    province,
    postalCode,
  };
}

/** Reverse geocode coordinates into PH-friendly address fields (Nominatim). */
export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<GeocodedAddressFields | null> {
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
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as NominatimReverseResponse;
  return mapNominatimToAddress(data);
}
