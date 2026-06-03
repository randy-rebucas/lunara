import { AddressType } from '@lunara/types';

export interface CustomerAddress {
  _id: string;
  label: string;
  addressType?: AddressType | string;
  line1: string;
  line2?: string;
  landmark?: string;
  notes?: string;
  city: string;
  province: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

export interface CustomerProfile {
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  loyaltyPoints?: number;
}

export interface AddressFormValues {
  label: string;
  addressType: AddressType;
  line1: string;
  line2: string;
  landmark: string;
  notes: string;
  city: string;
  province: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

export const emptyAddressForm = (): AddressFormValues => ({
  label: 'Home',
  addressType: AddressType.HOME,
  line1: '',
  line2: '',
  landmark: '',
  notes: '',
  city: '',
  province: 'Metro Manila',
  postalCode: '',
  isDefault: false,
});

function parseLegacyLine2(line2?: string): { line2: string; landmark: string; notes: string } {
  if (!line2) return { line2: '', landmark: '', notes: '' };
  try {
    if (line2.startsWith('{')) {
      const parsed = JSON.parse(line2) as { line2?: string; landmark?: string; notes?: string };
      return {
        line2: parsed.line2 ?? '',
        landmark: parsed.landmark ?? '',
        notes: parsed.notes ?? '',
      };
    }
  } catch {
    // fall through to plain text line2
  }
  return { line2, landmark: '', notes: '' };
}

export function encodeAddressLine2(values: Pick<AddressFormValues, 'line2' | 'landmark' | 'notes'>): string | undefined {
  const line2 = values.line2.trim();
  const landmark = values.landmark.trim();
  const notes = values.notes.trim();
  if (!line2 && !landmark && !notes) return undefined;
  return JSON.stringify({ line2, landmark, notes });
}

export function addressToForm(address: CustomerAddress): AddressFormValues {
  const parsed = parseLegacyLine2(address.line2);
  return {
    label: address.label,
    addressType: (address.addressType as AddressType) ?? AddressType.HOME,
    line1: address.line1,
    line2: parsed.line2,
    landmark: parsed.landmark,
    notes: parsed.notes,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    latitude: address.latitude,
    longitude: address.longitude,
    isDefault: address.isDefault,
  };
}
