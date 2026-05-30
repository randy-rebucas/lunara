import type { BookingType } from '@lunara/types';

export type BookingStep =
  | 'service'
  | 'address'
  | 'schedule'
  | 'weight'
  | 'addons'
  | 'review'
  | 'confirm';

export const BOOKING_STEPS: { id: BookingStep; label: string }[] = [
  { id: 'service', label: 'Service' },
  { id: 'address', label: 'Address' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'weight', label: 'Weight' },
  { id: 'addons', label: 'Add-ons' },
  { id: 'review', label: 'Estimate' },
  { id: 'confirm', label: 'Confirm' },
];

export interface BookingFormState {
  bookingType: BookingType | null;
  addressId: string;
  scheduledPickupAt: string;
  weightKg: number;
  addonIds: string[];
}

export const initialBookingForm: BookingFormState = {
  bookingType: null,
  addressId: '',
  scheduledPickupAt: '',
  weightKg: 5,
  addonIds: [],
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
