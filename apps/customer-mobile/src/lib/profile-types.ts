import { AddressType } from '@lunara/types';
import type {
  BusinessSummary,
  BusinessSummaryMonth,
  CustomerAddress,
  FavoriteBranch,
  ImpactSummary,
} from '@lunara/types';

export type { BusinessSummary, BusinessSummaryMonth, CustomerAddress, FavoriteBranch, ImpactSummary };

export interface CustomerProfile {
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  /** Referral-bonus balance only — loyalty is a partner-level feature now (see RewardsService),
   * so per-shop order points live in /rewards/me, not here. */
  loyaltyPoints?: number;
  isBusiness?: boolean;
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

export function addressToForm(address: CustomerAddress): AddressFormValues {
  return {
    label: address.label,
    addressType: (address.addressType as AddressType) ?? AddressType.HOME,
    line1: address.line1,
    line2: address.line2 ?? '',
    landmark: address.landmark ?? '',
    notes: address.deliveryInstructions ?? '',
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    latitude: address.latitude,
    longitude: address.longitude,
    isDefault: address.isDefault,
  };
}
