import { AddressType } from '@lunara/types';

export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  [AddressType.HOME]: 'Home',
  [AddressType.WORK]: 'Work',
  [AddressType.APARTMENT]: 'Apartment',
  [AddressType.OTHER]: 'Other',
};

export const ADDRESS_TYPE_OPTIONS = Object.entries(ADDRESS_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as AddressType, label }),
);

export function formatAddressTypeLabel(type?: string) {
  if (!type || !(type in ADDRESS_TYPE_LABELS)) return ADDRESS_TYPE_LABELS[AddressType.HOME];
  return ADDRESS_TYPE_LABELS[type as AddressType];
}

export function defaultLabelForAddressType(type: AddressType) {
  return ADDRESS_TYPE_LABELS[type];
}
