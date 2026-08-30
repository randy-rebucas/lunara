import { BookingType } from '@lunara/types';
import type { BranchHoliday, BranchPricingMode, GarmentItem } from '@lunara/utils';

export interface BookingWizardProps {
  initialCouponCode?: string;
  reorderOrderId?: string;
}

export interface ReorderSourceOrder {
  _id: string;
  branchId?: string;
  bookingType: BookingType;
  bagSizeId?: string;
  addons?: { id: string; quantity?: number }[];
  pickupAddressId?: string;
  customerNotes?: string;
}

export interface AddressOption {
  _id: string;
  label: string;
  addressType?: string;
  line1: string;
  city: string;
  province: string;
  postalCode: string;
  deliveryInstructions?: string;
  latitude?: number;
  longitude?: number;
}

export function addressHasCoords(address?: AddressOption | null) {
  return address?.latitude != null && address?.longitude != null;
}

export interface BookingConfig {
  services: import('@lunara/utils').LaundryServiceOption[];
  addons: import('@lunara/utils').BookingAddonOption[];
  minOrderAmount: number;
  bagSizes: import('@lunara/utils').BagSizeOption[];
  deliveryFee: number;
}

export interface ShopServiceOption {
  type: BookingType;
  label: string;
  description?: string;
  basePricePerKg: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  basePricePerPair?: number;
  basePricePerItem?: number;
  fixedPrice?: number;
  pricingUnit?: BranchPricingMode;
  customerPricePerKg: number;
  customerPricePerLoad?: number;
  customerPricePerPiece?: number;
  customerPricePerPair?: number;
  customerPricePerItem?: number;
  customerFixedPrice?: number;
  isCustom?: boolean;
  customServiceId?: string;
}

export interface ShopAddonOption {
  slug: string;
  label: string;
  description?: string;
  basePrice: number;
  customerPrice: number;
  pricingUnit?: BranchPricingMode;
  isPercentOfService?: boolean;
  isCustom?: boolean;
  customAddonId?: string;
  applicableServiceTypes?: string[];
  allowsQuantity?: boolean;
  maxQuantity?: number;
  /** Units of this add-on bundled free into the service by the shop — only the customer's
   * quantity beyond this is billed. */
  includedQuantity?: number;
}

/** Every other branch in the same partner's group carries the same full shape as the group's
 * headline shop (pricing, schedule, withinRadius, capacity) — see findNearbyShopsWithPricing. */
export type ShopBranchVariant = Omit<ShopOption, 'mainShopId' | 'branches'>;

export interface ShopOption {
  branchId: string;
  mainShopId: string;
  isMainShop: boolean;
  code: string;
  name: string;
  city: string;
  distanceKm: number;
  distanceLabel: string;
  withinRadius: boolean;
  /** Platform-wide delivery ceiling — beyond this, checkout always rejects the order regardless
   * of branch, so this must gate selectability, not just styling. */
  withinMaxDeliveryRadius: boolean;
  capacityAvailable: boolean;
  logoUrl?: string;
  pricingMode: BranchPricingMode;
  kgPerLoad?: number;
  operatingHours: { isClosed: boolean; openTime: string; closeTime: string }[];
  holidays: BranchHoliday[];
  services: ShopServiceOption[];
  addons: ShopAddonOption[];
  branches: ShopBranchVariant[];
  /** GARMENT_CATALOG filtered to what this shop offers — falls back to the full catalog if absent. */
  garmentCatalog?: GarmentItem[];
}
