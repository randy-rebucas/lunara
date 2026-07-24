import { AddressType } from '@lunara/types';

export interface CustomerAddress {
  _id: string;
  label: string;
  addressType?: AddressType | string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

export interface FavoriteBranch {
  branchId: string;
  code: string;
  name: string;
  city: string;
  logoUrl?: string;
  favoritedAt: string;
}

export interface BusinessSummaryMonth {
  month: string;
  orderCount: number;
  totalSpend: number;
}

export interface BusinessSummary {
  months: BusinessSummaryMonth[];
  totalOrders: number;
  totalSpend: number;
}

export interface ImpactSummary {
  totalWeightKg: number;
  orderCount: number;
  estimatedCo2SavedKg: number;
}

export interface CustomerProfile {
  _id?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  loyaltyPoints?: number;
  isBusiness?: boolean;
}

export interface AddressFormValues {
  label: string;
  addressType: AddressType;
  line1: string;
  line2: string;
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
  city: '',
  province: 'Metro Manila',
  postalCode: '',
  isDefault: false,
});

export function addressToForm(address: CustomerAddress): AddressFormValues {
  return {
    label: address.label,
    addressType: (address.addressType as AddressType) ?? AddressType.HOME,
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    latitude: address.latitude,
    longitude: address.longitude,
    isDefault: address.isDefault,
  };
}
