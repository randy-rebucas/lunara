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
  { id: 'weight', label: 'Details' },
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
  /** Customer-entered weight (kg) — used for shops in PER_KG or PER_LOAD pricing mode. */
  enteredWeightKg: string;
  /** Customer-entered load count — used for shops in PER_LOAD pricing mode. */
  enteredLoadCount: string;
  /** Customer-entered piece count — used for shops in PER_PIECE pricing mode. */
  enteredPieceCount: string;
  /** Selected garments + quantity — used for garment-priced booking types (see
   * GARMENT_PRICED_BOOKING_TYPES, currently just Dry Cleaning). Keyed by garment id. */
  garmentQuantities: Record<string, string>;
  addonIds: string[];
  couponCode: string;
}

export const initialBookingForm: BookingFormState = {
  bookingType: null,
  customServiceId: '',
  addressId: '',
  branchId: '',
  autoDispatch: false,
  scheduledPickupAt: '',
  bagSizeId: '',
  enteredWeightKg: '',
  enteredLoadCount: '',
  enteredPieceCount: '',
  garmentQuantities: {},
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
