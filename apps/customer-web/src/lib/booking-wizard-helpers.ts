import type { OperatingHours } from '@lunara/types';
import {
  BranchPricingMode,
  formatCurrency,
  isGarmentPricedBookingType,
  validatePickupTime,
  type BranchHoliday,
  type GarmentSelection,
  type MultiServiceQuoteBreakdown,
} from '@lunara/utils';
import {
  BOOKING_MIN_ORDER_AMOUNT,
} from '@lunara/utils';
import type { BookingFormState, BookingStep, ServiceSelectionState } from './booking-flow';
import { addressHasCoords, type AddressOption, type ShopOption, type ShopServiceOption } from './booking-wizard-types';

// Each service on a shop can bill in its own unit, so pricing mode/rates must be resolved per
// selected service rather than once per shop. Custom services are always priced per-kg.
export function resolveShopService(
  selectedShop: ShopOption | undefined,
  service: ServiceSelectionState,
): ShopServiceOption | undefined {
  return service.customServiceId
    ? selectedShop?.services.find((s) => s.customServiceId === service.customServiceId)
    : selectedShop?.services.find((s) => s.type === service.bookingType && !s.isCustom);
}

export function resolveShopPricingMode(
  selectedShop: ShopOption | undefined,
  service: ServiceSelectionState,
): BranchPricingMode {
  const shopService = resolveShopService(selectedShop, service);
  return (
    shopService?.pricingUnit ??
    (service.customServiceId ? BranchPricingMode.PER_KG : BranchPricingMode.FLAT_BAG)
  );
}

/** Non-empty garmentSelections payload for garment-priced booking types, else undefined. */
export function buildGarmentSelectionsForService(
  service: ServiceSelectionState,
): GarmentSelection[] | undefined {
  if (!isGarmentPricedBookingType(service.bookingType)) return undefined;
  const selections = Object.entries(service.garmentQuantities)
    .map(([garmentId, qty]) => ({ garmentId, quantity: Number(qty) || 0 }))
    .filter((sel) => sel.quantity > 0);
  return selections.length > 0 ? selections : undefined;
}

export function serviceSelectionToRequestBody(service: ServiceSelectionState) {
  const garmentSelections = buildGarmentSelectionsForService(service);
  return {
    bookingType: service.bookingType,
    ...(service.customServiceId ? { customServiceId: service.customServiceId } : {}),
    ...(service.bagSizeId ? { bagSizeId: service.bagSizeId } : {}),
    ...(Number(service.enteredWeightKg) ? { enteredWeightKg: Number(service.enteredWeightKg) } : {}),
    ...(Number(service.enteredLoadCount) ? { enteredLoadCount: Number(service.enteredLoadCount) } : {}),
    ...(Number(service.enteredPieceCount) ? { enteredPieceCount: Number(service.enteredPieceCount) } : {}),
    ...(garmentSelections ? { garmentSelections } : {}),
  };
}

export function getNextStepLabel(step: BookingStep): string {
  switch (step) {
    case 'address':
      return 'Continue to shop selection';
    case 'shop':
      return 'Continue to service selection';
    case 'service':
      return 'Continue to schedule';
    case 'schedule':
      return 'Continue to weight';
    case 'weight':
      return 'Continue to add-ons';
    case 'addons':
      return 'Review estimate';
    case 'review':
      return 'Continue to confirm';
    default:
      return 'Continue';
  }
}

export function canProceedStep(
  step: BookingStep,
  form: BookingFormState,
  localQuote: MultiServiceQuoteBreakdown | null,
  addresses: AddressOption[],
  schedule: { operatingHours: OperatingHours; holidays: BranchHoliday[] } | null,
): boolean {
  switch (step) {
    case 'service':
      return form.services.length > 0;
    case 'address':
      return (
        Boolean(form.addressId) &&
        addresses.length > 0 &&
        addressHasCoords(addresses.find((a) => a._id === form.addressId))
      );
    case 'shop':
      return Boolean(form.branchId) || form.autoDispatch;
    case 'schedule':
      return (
        Boolean(form.scheduledPickupAt) &&
        Boolean(schedule) &&
        validatePickupTime(form.scheduledPickupAt, schedule!.operatingHours, schedule!.holidays).valid
      );
    case 'weight':
      return Boolean(localQuote) && Boolean(localQuote?.meetsWeightMinimum);
    case 'addons':
      return Boolean(localQuote?.meetsMinimum);
    case 'review':
      return Boolean(localQuote?.meetsMinimum);
    default:
      return false;
  }
}

export function goNextStepError(
  step: BookingStep,
  form: BookingFormState,
  addresses: AddressOption[],
): string {
  if (step === 'service') return 'Select a service';
  if (step === 'address') {
    const selectedAddr = addresses.find((a) => a._id === form.addressId);
    return form.addressId && !addressHasCoords(selectedAddr)
      ? 'Selected address has no GPS pin. Update it in your Profile with "Use current location".'
      : 'Select a pickup address';
  }
  if (step === 'schedule') return 'Select a pickup time';
  if (step === 'weight') {
    return form.services.some((s) => isGarmentPricedBookingType(s.bookingType))
      ? 'Select at least one garment to continue.'
      : `Minimum order is ${formatCurrency(BOOKING_MIN_ORDER_AMOUNT)}. Choose a bag size to continue.`;
  }
  return '';
}
