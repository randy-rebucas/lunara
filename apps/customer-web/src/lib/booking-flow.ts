import type { BookingType } from '@lunara/types';

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
  { id: 'service', label: 'Service' },
  { id: 'address', label: 'Address' },
  { id: 'shop', label: 'Shop' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'weight', label: 'Weight' },
  { id: 'addons', label: 'Add-ons' },
  { id: 'review', label: 'Estimate' },
  { id: 'confirm', label: 'Confirm' },
];

export interface BookingFormState {
  bookingType: BookingType | null;
  addressId: string;
  branchId: string;
  scheduledPickupAt: string;
  weightKg: number;
  addonIds: string[];
  couponCode: string;
  orderId: string;
}

export const initialBookingForm: BookingFormState = {
  bookingType: null,
  addressId: '',
  branchId: '',
  scheduledPickupAt: '',
  weightKg: 5,
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
