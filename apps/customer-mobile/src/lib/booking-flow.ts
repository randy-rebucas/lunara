import type { BookingType } from '@lunara/types';
import type { BagSizeId } from '@lunara/utils';

export type BookingStep =
  | 'service'
  | 'address'
  | 'shop'
  | 'schedule'
  | 'weight'
  | 'addons'
  | 'review'
  | 'confirm';

export const BOOKING_STEPS: { id: BookingStep; label: string }[] = [
  { id: 'address', label: 'Address' },
  { id: 'shop', label: 'Shop' },
  { id: 'service', label: 'Service' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'weight', label: 'Bag size' },
  { id: 'addons', label: 'Add-ons' },
  { id: 'review', label: 'Estimate' },
  { id: 'confirm', label: 'Confirm' },
];

export interface BookingFormState {
  bookingType: BookingType | null;
  customServiceId: string;
  addressId: string;
  branchId: string;
  scheduledPickupAt: string;
  bagSizeId: BagSizeId | '';
  addonIds: string[];
  couponCode: string;
}

export const initialBookingForm: BookingFormState = {
  bookingType: null,
  customServiceId: '',
  addressId: '',
  branchId: '',
  scheduledPickupAt: '',
  bagSizeId: '',
  addonIds: [],
  couponCode: '',
};

export function nextStep(step: BookingStep): BookingStep | null {
  const idx = BOOKING_STEPS.findIndex((s) => s.id === step);
  if (idx < 0 || idx >= BOOKING_STEPS.length - 1) return null;
  return BOOKING_STEPS[idx + 1].id;
}

export function prevStep(step: BookingStep): BookingStep | null {
  const idx = BOOKING_STEPS.findIndex((s) => s.id === step);
  if (idx <= 0) return null;
  return BOOKING_STEPS[idx - 1].id;
}
