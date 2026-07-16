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
  | 'confirm'
  | 'done';

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
  /** When true, branchId is left blank and the shop is picked network-wide by Lunara at booking time. */
  autoDispatch: boolean;
  scheduledPickupAt: string;
  bagSizeId: BagSizeId | '';
  addonIds: string[];
  couponCode: string;
  orderId: string;
}

export const initialBookingForm: BookingFormState = {
  bookingType: null,
  customServiceId: '',
  addressId: '',
  branchId: '',
  autoDispatch: false,
  scheduledPickupAt: '',
  bagSizeId: '',
  addonIds: [],
  couponCode: '',
  orderId: '',
};

export function stepIndex(step: BookingStep) {
  return BOOKING_STEPS.findIndex((s) => s.id === step);
}

export function nextStep(step: BookingStep): BookingStep | null {
  const idx = stepIndex(step);
  if (idx < 0 || idx >= BOOKING_STEPS.length - 1) return null;
  return BOOKING_STEPS[idx + 1].id;
}

export function prevStep(step: BookingStep): BookingStep | null {
  const idx = stepIndex(step);
  if (idx <= 0) return null;
  return BOOKING_STEPS[idx - 1].id;
}
