import { AddonCategory, BookingType, ServiceCategory, type DayOperatingHours, type OperatingHours } from '@lunara/types';

export const BOOKING_MIN_ORDER_AMOUNT = 150;
/** @deprecated use BOOKING_FLAT_DELIVERY_FEE */
export const BOOKING_DELIVERY_FEE = 50;
/** Flat pickup + delivery fee charged on every booking. */
export const BOOKING_FLAT_DELIVERY_FEE = 70;
/** Distance (km) covered by the base delivery fee before per-km charges kick in. */
export const BOOKING_DELIVERY_BASE_DISTANCE_KM = 3;
/** Charge per whole km beyond BOOKING_DELIVERY_BASE_DISTANCE_KM. */
export const BOOKING_DELIVERY_PER_KM_RATE = 8;

/** Delivery Fee = Base Fare + (chargeable distance x per-km rate), where chargeable distance is
 * whatever's beyond the base allowance, rounded up to the next whole km. */
export function calculateDeliveryFee(
  distanceKm: number,
  baseFee: number = BOOKING_FLAT_DELIVERY_FEE,
  baseDistanceKm: number = BOOKING_DELIVERY_BASE_DISTANCE_KM,
  perKmRate: number = BOOKING_DELIVERY_PER_KM_RATE,
): number {
  const chargeableKm = Math.max(0, Math.ceil(distanceKm - baseDistanceKm));
  return baseFee + chargeableKm * perKmRate;
}
/** Lunara's markup on a partner shop's own add-on prices. Base service pricing is flat bag pricing
 * (see BAG_SIZES) and no longer uses this — add-ons still do. Single source of truth — never hardcode 1.30 elsewhere. */
export const SHOP_PRICE_MARKUP_MULTIPLIER = 1.3;

/** Minimum capacity per washing machine load (kg). */
export const BOOKING_MACHINE_LOAD_MIN_KG = 8;

export function machineLoadInfo(kgPerLoad: number = BOOKING_MACHINE_LOAD_MIN_KG): string {
  return `Each machine holds up to ${kgPerLoad} kg per load — every additional ${kgPerLoad} kg (or part of it) counts as another load.`;
}

/** @deprecated use machineLoadInfo(kgPerLoad) so the copy reflects the shop's own machine capacity. */
export const BOOKING_MACHINE_LOAD_INFO = machineLoadInfo(BOOKING_MACHINE_LOAD_MIN_KG);

/** Overall minimum weight for a weight-based booking (FLAT_BAG/PER_KG/PER_LOAD) — does not apply to PER_PIECE. */
export const BOOKING_MIN_WEIGHT_KG = 5;

/** Minimum weight a customer can enter for PER_KG/PER_LOAD pricing — one load's worth is billed
 * regardless, so there's no reason to force a higher floor than this. */
export const BOOKING_PER_KG_MIN_KG = 1;

/** @deprecated per-kg pricing's real ceiling is the shop's own kgPerLoad (see resolvePerKgMaxKg) —
 * this flat default only applies when a branch hasn't configured kgPerLoad. */
export const BOOKING_PER_KG_MAX_KG = 5;

/** Per-kg pricing only applies up to one machine load's capacity — heavier weights are billed per
 * machine load instead, so the ceiling must track the shop's own kgPerLoad, not a flat default. */
export function resolvePerKgMaxKg(kgPerLoad: number = BOOKING_MACHINE_LOAD_MIN_KG): number {
  return kgPerLoad;
}

/** Load-count cap referenced by the per-kg → per-load guidance (2 loads = up to 16 kg). */
export const BOOKING_PER_KG_MAX_LOAD_COUNT = 2;

/** Number of 8kg machine loads needed for a given weight, rounded up (min 1). Used both for
 * dispatch/display capacity estimates and — for PER_LOAD pricing — as the billed load count when
 * the customer/partner enters a weight instead of an explicit load count, so it must scale with
 * weight rather than cap out (a capped estimate would systematically underbill heavy orders). */
export function estimateMachineLoads(
  weightKg: number,
  kgPerLoad: number = BOOKING_MACHINE_LOAD_MIN_KG,
): number {
  if (weightKg <= 0) return 1;
  return Math.max(1, Math.ceil(weightKg / kgPerLoad));
}

export function formatMachineLoadLabel(
  weightKg: number,
  kgPerLoad: number = BOOKING_MACHINE_LOAD_MIN_KG,
): string {
  const loads = estimateMachineLoads(weightKg, kgPerLoad);
  return `${loads} machine load${loads === 1 ? '' : 's'}`;
}

export interface LaundryServiceOption {
  type: BookingType;
  label: string;
  description: string;
  /** Grouping for catalog display (e.g. "Core Laundry", "Specialty") — not billing-relevant. */
  category?: ServiceCategory;
  /** @deprecated Base pricing is flat by bag size (see BAG_SIZES), not per kg. Kept for legacy/display reference only. */
  pricePerKg: number;
  /** @deprecated Base pricing is flat by bag size (see BAG_SIZES), not per kg. Kept for legacy/display reference only. */
  minWeightKg: number;
}

export type BagSizeId = 'small' | 'medium' | 'large' | 'xl';

export interface BagSizeOption {
  id: BagSizeId;
  label: string;
  /** Nominal capacity in kg — used for machine-load estimates and dispatch capacity scoring, not billing. */
  capacityKg: number;
  /** Flat price, same platform-wide regardless of booking type or partner shop. */
  price: number;
}

/** Flat, platform-wide bag pricing — replaces per-kg weight-based pricing for all booking types. */
export const BAG_SIZES: BagSizeOption[] = [
  { id: 'small', label: 'Small', capacityKg: 5, price: 249 },
  { id: 'medium', label: 'Medium', capacityKg: 7, price: 349 },
  { id: 'large', label: 'Large', capacityKg: 12, price: 449 },
  { id: 'xl', label: 'XL', capacityKg: 15, price: 549 },
];

export function getBagSize(id: string): BagSizeOption | undefined {
  return BAG_SIZES.find((b) => b.id === id);
}

/** Sanity ceiling for a customer-entered weight (PER_LOAD's estimate, or PER_KG's minimum-based
 * floor) — nothing this app books comes close to needing more than the largest bag's capacity, so
 * anything past it is almost certainly a typo rather than a real order. */
export const BOOKING_MAX_WEIGHT_KG = Math.max(...BAG_SIZES.map((b) => b.capacityKg));

/** The smallest bag whose capacity fits a given weight — used to show a live "appropriate bag"
 * preview on the PER_KG/PER_LOAD weight steps (informational only; those modes don't bill by bag). */
export function recommendBagForWeight(
  weightKg: number,
  bagSizes: BagSizeOption[] = BAG_SIZES,
): BagSizeOption | undefined {
  if (weightKg <= 0 || bagSizes.length === 0) return undefined;
  return bagSizes.find((bag) => weightKg <= bag.capacityKg) ?? bagSizes[bagSizes.length - 1];
}

export interface BookingAddonOption {
  id: string;
  label: string;
  description: string;
  /** Grouping for catalog display (e.g. "Treatment", "Protection") — not billing-relevant. */
  category?: AddonCategory;
  /** Flat total when pricingUnit is FLAT_BAG (or unset); the per-kg/load/piece rate for other
   * pricingUnit values; or the percentage (e.g. 50 for 50%) when isPercentOfService is true —
   * pricingUnit is ignored in that case. */
  price: number;
  pricingUnit?: BranchPricingMode;
  /** Global-catalog-only pricing kind (see catalog.seed.ts) — not partner-configurable, unlike
   * pricingUnit. When true, this add-on's total is serviceSubtotal × price/100, not a flat/unit rate. */
  isPercentOfService?: boolean;
  imageUrl?: string;
  /** Booking types this add-on may be attached to (empty/unset = applies to any service). */
  applicableServiceTypes?: BookingType[];
  /** Global-catalog-only. When true, customers pick a quantity (1..maxQuantity) via a stepper
   * instead of a plain on/off toggle. Only meaningful for FLAT_BAG/FIXED, non-percent add-ons —
   * ignored for PER_KG/PER_LOAD/PER_PIECE/PER_PAIR/PER_ITEM and isPercentOfService add-ons, which
   * already scale off the order's own weight/piece count; combining both would double-scale. */
  allowsQuantity?: boolean;
  /** Upper bound for the stepper when allowsQuantity is true. Defaults to 5 if unset. */
  maxQuantity?: number;
}

export interface ServiceAreaRule {
  id: string;
  label: string;
  cities: string[];
  provinces: string[];
  postalPrefixes: string[];
  /** Booking types available in this area (empty = all). */
  services: BookingType[];
}

export interface AddressInput {
  city: string;
  province: string;
  postalCode: string;
  line1: string;
}

export enum BranchPricingMode {
  FLAT_BAG = 'flat_bag',
  PER_KG = 'per_kg',
  PER_LOAD = 'per_load',
  PER_PIECE = 'per_piece',
  PER_PAIR = 'per_pair',
  PER_ITEM = 'per_item',
  FIXED = 'fixed',
}

/** Partner's own rates for the active pricing mode; branch-level, resolved server-side. */
export interface PricingModeRates {
  basePricePerKg?: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  basePricePerPair?: number;
  basePricePerItem?: number;
  /** Flat total for FIXED pricing mode, regardless of quantity. */
  fixedPrice?: number;
  minWeightKg?: number;
}

export interface GarmentItem {
  id: string;
  category: string;
  label: string;
  /** Reference price only — the app doesn't yet support per-branch overrides for garment pricing. */
  price: number;
}

export interface GarmentSelection {
  garmentId: string;
  quantity: number;
}

/** Booking types billed by summing selected garments × quantity instead of any BranchPricingMode —
 * see GARMENT_CATALOG. Dry cleaning is priced per garment type, not by weight/piece/kg. */
export const GARMENT_PRICED_BOOKING_TYPES: BookingType[] = [BookingType.DRY_CLEANING];

export function isGarmentPricedBookingType(bookingType: BookingType): boolean {
  return GARMENT_PRICED_BOOKING_TYPES.includes(bookingType);
}

export function getGarment(id: string, catalog: GarmentItem[] = GARMENT_CATALOG): GarmentItem | undefined {
  return catalog.find((g) => g.id === id);
}

export function getGarmentCategories(catalog: GarmentItem[] = GARMENT_CATALOG): string[] {
  return [...new Set(catalog.map((g) => g.category))];
}

/** Sums selected garments × quantity — the whole basis for GARMENT_PRICED_BOOKING_TYPES billing. */
export function computeGarmentSubtotal(
  selections: GarmentSelection[],
  catalog: GarmentItem[] = GARMENT_CATALOG,
): number {
  return selections.reduce((sum, sel) => {
    if (sel.quantity <= 0) return sum;
    const garment = getGarment(sel.garmentId, catalog);
    return garment ? sum + garment.price * sel.quantity : sum;
  }, 0);
}

export interface QuoteInput {
  bookingType: BookingType;
  /** Required when pricingMode is FLAT_BAG (or omitted), unless bookingType is garment-priced. */
  bagSizeId?: BagSizeId;
  addonIds: string[];
  /** Defaults to FLAT_BAG (today's behavior) when omitted. Ignored for garment-priced booking types. */
  pricingMode?: BranchPricingMode;
  /** Partner's rates for the active mode — required when pricingMode is PER_KG, PER_LOAD, PER_PIECE, PER_PAIR, PER_ITEM, or FIXED. */
  rates?: PricingModeRates;
  /** Customer-entered weight — required for PER_KG, and used to derive load count for PER_LOAD if enteredLoadCount is omitted. */
  enteredWeightKg?: number;
  /** Customer-entered load count — required for PER_LOAD unless enteredWeightKg is provided instead. */
  enteredLoadCount?: number;
  /** Customer-entered piece/pair/item count — required for PER_PIECE, PER_PAIR, and PER_ITEM. */
  enteredPieceCount?: number;
  /** Required (non-empty) when bookingType is garment-priced (see GARMENT_PRICED_BOOKING_TYPES) — the
   * service subtotal is computed as sum(garment price × quantity) instead of any BranchPricingMode. */
  garmentSelections?: GarmentSelection[];
  /** kg capacity per machine load for this shop's PER_LOAD pricing/estimation. Defaults to
   * BOOKING_MACHINE_LOAD_MIN_KG when the shop hasn't configured its own value. */
  kgPerLoad?: number;
  /** Customer-chosen quantity per add-on id (e.g. { liquid_detergent: 3 }) — only honored for
   * FLAT_BAG/FIXED add-ons whose catalog entry has allowsQuantity; ignored otherwise. */
  addonQuantities?: Record<string, number>;
}

/** Computes the base laundry service subtotal for a given pricing mode. Shared between booking-time
 * estimates and pickup-time finalization so both use identical math. */
export function computeServiceSubtotal(
  mode: BranchPricingMode,
  rates: PricingModeRates | undefined,
  qty: { bag?: BagSizeOption; weightKg?: number; loadCount?: number; pieceCount?: number },
  kgPerLoad: number = BOOKING_MACHINE_LOAD_MIN_KG,
): number {
  switch (mode) {
    case BranchPricingMode.PER_KG: {
      const perKg = rates?.basePricePerKg;
      if (perKg == null) throw new Error('Missing basePricePerKg for PER_KG pricing mode');
      const minWeight = rates?.minWeightKg ?? 0;
      const weightKg = Math.max(qty.weightKg ?? 0, minWeight);
      return Math.round(weightKg * perKg * 100) / 100;
    }
    case BranchPricingMode.PER_LOAD: {
      const perLoad = rates?.basePricePerLoad;
      if (perLoad == null) throw new Error('Missing basePricePerLoad for PER_LOAD pricing mode');
      const loadCount =
        qty.loadCount ?? (qty.weightKg != null ? estimateMachineLoads(qty.weightKg, kgPerLoad) : 0);
      return Math.round(loadCount * perLoad * 100) / 100;
    }
    case BranchPricingMode.PER_PIECE: {
      const perPiece = rates?.basePricePerPiece;
      if (perPiece == null) throw new Error('Missing basePricePerPiece for PER_PIECE pricing mode');
      const pieceCount = qty.pieceCount ?? 0;
      return Math.round(pieceCount * perPiece * 100) / 100;
    }
    case BranchPricingMode.PER_PAIR: {
      const perPair = rates?.basePricePerPair;
      if (perPair == null) throw new Error('Missing basePricePerPair for PER_PAIR pricing mode');
      const pairCount = qty.pieceCount ?? 0;
      return Math.round(pairCount * perPair * 100) / 100;
    }
    case BranchPricingMode.PER_ITEM: {
      const perItem = rates?.basePricePerItem;
      if (perItem == null) throw new Error('Missing basePricePerItem for PER_ITEM pricing mode');
      const itemCount = qty.pieceCount ?? 0;
      return Math.round(itemCount * perItem * 100) / 100;
    }
    case BranchPricingMode.FIXED: {
      const fixedPrice = rates?.fixedPrice;
      if (fixedPrice == null) throw new Error('Missing fixedPrice for FIXED pricing mode');
      return fixedPrice;
    }
    case BranchPricingMode.FLAT_BAG:
    default: {
      if (!qty.bag) throw new Error('Missing bag size for FLAT_BAG pricing mode');
      return qty.bag.price;
    }
  }
}

export interface QuoteBreakdown {
  bookingType: BookingType;
  serviceLabel: string;
  bagSizeId?: BagSizeId;
  bagLabel: string;
  /** Nominal weight from the bag's capacity — for machine-load estimates and display, not billing. */
  weightKg: number;
  serviceSubtotal: number;
  /** `price` is the computed line total (already rate × quantity for non-flat units, or
   * serviceSubtotal × percent/100 for percent-of-service add-ons). `unit`/`quantity` describe
   * what that total was computed from, for display; `percent` is set instead for percent add-ons. */
  addons: {
    id: string;
    label: string;
    price: number;
    unit?: BranchPricingMode;
    quantity?: number;
    /** Customer-chosen "buy N of this add-on" count (e.g. 3x liquid detergent) — distinct from
     * `quantity` above, which is the order's own derived weight/load/piece count for PER_KG/
     * PER_LOAD/etc. add-ons. Only meaningful when the add-on's catalog entry has allowsQuantity. */
    addonQuantity?: number;
    percent?: number;
  }[];
  addonsSubtotal: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  meetsMinimum: boolean;
  minimumOrderAmount: number;
  /** False only when this is a weight-based mode (not PER_PIECE) and enteredWeightKg is below BOOKING_MIN_WEIGHT_KG. */
  meetsWeightMinimum: boolean;
  minimumWeightKg: number;
  couponCode?: string;
  promotionTitle?: string;
  pricingMode: BranchPricingMode;
  /** Set only for garment-priced booking types (see GARMENT_PRICED_BOOKING_TYPES) — the garment
   * selections serviceSubtotal was computed from. */
  garmentSelections?: GarmentSelection[];
  /** PER_PIECE orders only — piece count the subtotal was computed from. */
  pieceCount?: number;
  /** True when the base service price is provisional (PER_KG/PER_LOAD/PER_PIECE) and will be confirmed at pickup. */
  isEstimate: boolean;
}

export interface MultiServiceQuoteBreakdown {
  services: QuoteBreakdown[];
  addons: QuoteBreakdown['addons'];
  addonsSubtotal: number;
  serviceSubtotal: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  meetsMinimum: boolean;
  minimumOrderAmount: number;
  meetsWeightMinimum: boolean;
  minimumWeightKg: number;
  couponCode?: string;
  promotionTitle?: string;
  isEstimate: boolean;
}

/** Combines per-service QuoteBreakdowns (each priced independently via calculateQuote) into one
 * order-level breakdown. Add-ons are priced once here against the combined service subtotal
 * (rather than per-service) so a percent-of-service add-on bills off the whole order, not just
 * whichever service happened to compute it. */
export function combineServiceQuotes(
  serviceQuotes: QuoteBreakdown[],
  addonOptions: BookingAddonOption[],
  addonIds: string[],
  deliveryFee: number,
  kgPerLoad: number = BOOKING_MACHINE_LOAD_MIN_KG,
  addonQuantities: Record<string, number> = {},
): MultiServiceQuoteBreakdown {
  if (!serviceQuotes.length) throw new Error('At least one service is required');

  const serviceSubtotal = serviceQuotes.reduce((sum, s) => sum + s.serviceSubtotal, 0);
  const combinedWeightKg = serviceQuotes.reduce((sum, s) => sum + s.weightKg, 0);
  const combinedPieceCount = serviceQuotes.reduce((sum, s) => sum + (s.pieceCount ?? 0), 0);

  const addons = addonIds
    .map((id) => addonOptions.find((a) => a.id === id))
    .filter((a): a is BookingAddonOption => !!a)
    .map((a) => {
      if (a.isPercentOfService) {
        const price = Math.round(serviceSubtotal * (a.price / 100) * 100) / 100;
        return { id: a.id, label: a.label, price, percent: a.price };
      }
      const unit = a.pricingUnit ?? BranchPricingMode.FLAT_BAG;
      const quantity =
        unit === BranchPricingMode.PER_KG
          ? combinedWeightKg
          : unit === BranchPricingMode.PER_LOAD
            ? estimateMachineLoads(combinedWeightKg, kgPerLoad)
            : unit === BranchPricingMode.PER_PIECE ||
                unit === BranchPricingMode.PER_PAIR ||
                unit === BranchPricingMode.PER_ITEM
              ? combinedPieceCount
              : undefined;
      const addonQuantity =
        (unit === BranchPricingMode.FLAT_BAG || unit === BranchPricingMode.FIXED) && a.allowsQuantity
          ? Math.max(1, Math.min(addonQuantities[a.id] ?? 1, a.maxQuantity ?? 5))
          : 1;
      const price =
        unit === BranchPricingMode.FLAT_BAG || unit === BranchPricingMode.FIXED
          ? Math.round(a.price * addonQuantity * 100) / 100
          : Math.round(a.price * (quantity ?? 0) * 100) / 100;
      return { id: a.id, label: a.label, price, unit, quantity, addonQuantity };
    });
  const addonsSubtotal = addons.reduce((sum, a) => sum + a.price, 0);
  const subtotal = serviceSubtotal + addonsSubtotal;
  const discount = 0;
  const total = subtotal + deliveryFee - discount;

  return {
    services: serviceQuotes,
    addons,
    addonsSubtotal,
    serviceSubtotal,
    subtotal,
    deliveryFee,
    discount,
    total,
    meetsMinimum: subtotal >= BOOKING_MIN_ORDER_AMOUNT,
    minimumOrderAmount: BOOKING_MIN_ORDER_AMOUNT,
    meetsWeightMinimum: serviceQuotes.every((s) => s.meetsWeightMinimum),
    minimumWeightKg: BOOKING_MIN_WEIGHT_KG,
    isEstimate: serviceQuotes.some((s) => s.isEstimate),
  };
}

export const LAUNDRY_SERVICES: LaundryServiceOption[] = [
  {
    type: BookingType.WASH_FOLD,
    label: 'Wash & Fold',
    description: 'Everyday clothes washed, dried, and folded',
    pricePerKg: 80,
    minWeightKg: 5,
  },
  {
    type: BookingType.WASH_DRY_FOLD,
    label: 'Wash, Dry & Fold',
    description: 'Full service including machine dry',
    pricePerKg: 120,
    minWeightKg: 5,
  },
  {
    type: BookingType.DRY_CLEANING,
    label: 'Dry Cleaning',
    description: 'Delicates, suits, and formal wear',
    pricePerKg: 200,
    minWeightKg: 5,
  },
];

export const BOOKING_ADDONS: BookingAddonOption[] = [
  {
    id: 'fabric_softener',
    label: 'Fabric softener',
    description: 'Extra soft finish',
    price: 25,
    allowsQuantity: true,
    maxQuantity: 5,
  },
  {
    id: 'liquid_detergent',
    label: 'Liquid detergent',
    description: 'Extra detergent for heavier or extra-dirty loads',
    price: 25,
    allowsQuantity: true,
    maxQuantity: 5,
  },
  {
    id: 'stain_treatment',
    label: 'Stain treatment',
    description: 'Pre-treatment for tough stains',
    price: 50,
  },
  {
    id: 'eco_wash',
    label: 'Eco wash',
    description: 'Hypoallergenic detergent',
    price: 30,
  },
  {
    id: 'express_delivery',
    label: 'Express return',
    description: 'Delivery within 24h after cleaning',
    price: 80,
  },
  {
    id: 'express_service_24h',
    label: 'Express Service (24 Hours)',
    description: 'Rushed turnaround — ready within 24 hours',
    price: 50,
    isPercentOfService: true,
  },
  {
    id: 'same_day_service',
    label: 'Same-Day Service',
    description: 'Ready the same day it\'s dropped off',
    price: 100,
    isPercentOfService: true,
  },
  {
    id: 'premium_stain_removal',
    label: 'Premium Stain Removal',
    description: 'Advanced treatment for tough or set-in stains',
    price: 100,
  },
  {
    id: 'heavy_stain_treatment',
    label: 'Heavy Stain Treatment',
    description: 'Deep treatment for heavily soiled garments',
    price: 150,
  },
  {
    id: 'odor_removal',
    label: 'Odor Removal',
    description: 'Deodorizing treatment for smoke, mildew, or other odors',
    price: 80,
  },
  {
    id: 'steam_pressing',
    label: 'Steam Pressing',
    description: 'Finishing steam press for a crisp, wrinkle-free look',
    price: 50,
  },
  {
    id: 'waterproofing',
    label: 'Waterproofing',
    description: 'Water-repellent treatment for jackets and outerwear',
    price: 200,
  },
  {
    id: 'fabric_protection',
    label: 'Fabric Protection',
    description: 'Protective coating against future stains',
    price: 150,
  },
  {
    id: 'minor_repair_button',
    label: 'Minor Repair (Button)',
    description: 'Button reattachment or replacement',
    price: 50,
  },
  {
    id: 'minor_stitching',
    label: 'Minor Stitching',
    description: 'Small seam or hem stitching',
    price: 80,
  },
  {
    id: 'garment_bag_packaging',
    label: 'Garment Bag Packaging',
    description: 'Protective garment bag for delivery',
    price: 30,
  },
  {
    id: 'premium_hanger',
    label: 'Premium Hanger',
    description: 'Upgraded hanger for delivered garments',
    price: 20,
  },
];

/** Reference dry-cleaning garment price list — platform-wide for now (no per-branch override yet).
 * Wedding Gown's real-world range (₱2,500–₱8,000) is collapsed to its low end as a starting price. */
export const GARMENT_CATALOG: GarmentItem[] = [
  { id: 'suit_jacket', category: 'Suits & Formal Wear', label: 'Suit Jacket', price: 250 },
  { id: 'suit_pants', category: 'Suits & Formal Wear', label: 'Suit Pants', price: 180 },
  { id: 'complete_suit_2pc', category: 'Suits & Formal Wear', label: 'Complete Suit (2-piece)', price: 400 },
  { id: 'three_piece_suit', category: 'Suits & Formal Wear', label: 'Three-piece Suit', price: 550 },
  { id: 'blazer', category: 'Suits & Formal Wear', label: 'Blazer', price: 250 },
  { id: 'sports_coat', category: 'Suits & Formal Wear', label: 'Sports Coat', price: 250 },
  { id: 'vest_waistcoat', category: 'Suits & Formal Wear', label: 'Vest / Waistcoat', price: 120 },
  { id: 'tuxedo_jacket', category: 'Suits & Formal Wear', label: 'Tuxedo Jacket', price: 350 },
  { id: 'tuxedo_pants', category: 'Suits & Formal Wear', label: 'Tuxedo Pants', price: 220 },
  { id: 'complete_tuxedo', category: 'Suits & Formal Wear', label: 'Complete Tuxedo', price: 550 },

  { id: 'dress_shirt', category: 'Shirts & Tops', label: 'Dress Shirt', price: 120 },
  { id: 'silk_shirt', category: 'Shirts & Tops', label: 'Silk Shirt', price: 180 },
  { id: 'polo_shirt', category: 'Shirts & Tops', label: 'Polo Shirt', price: 100 },
  { id: 'long_sleeve_shirt', category: 'Shirts & Tops', label: 'Long Sleeve Shirt', price: 120 },
  { id: 'blouse', category: 'Shirts & Tops', label: 'Blouse', price: 120 },
  { id: 'silk_blouse', category: 'Shirts & Tops', label: 'Silk Blouse', price: 180 },
  { id: 'sweater', category: 'Shirts & Tops', label: 'Sweater', price: 180 },
  { id: 'cardigan', category: 'Shirts & Tops', label: 'Cardigan', price: 180 },
  { id: 'hoodie', category: 'Shirts & Tops', label: 'Hoodie', price: 180 },
  { id: 'knitwear', category: 'Shirts & Tops', label: 'Knitwear', price: 200 },

  { id: 'casual_dress', category: 'Dresses', label: 'Casual Dress', price: 220 },
  { id: 'cocktail_dress', category: 'Dresses', label: 'Cocktail Dress', price: 350 },
  { id: 'evening_gown', category: 'Dresses', label: 'Evening Gown', price: 650 },
  { id: 'formal_gown', category: 'Dresses', label: 'Formal Gown', price: 750 },
  { id: 'wedding_gown', category: 'Dresses', label: 'Wedding Gown', price: 2500 },
  { id: 'bridesmaid_dress', category: 'Dresses', label: 'Bridesmaid Dress', price: 400 },
  { id: 'prom_dress', category: 'Dresses', label: 'Prom Dress', price: 450 },

  { id: 'dress_pants', category: 'Bottoms', label: 'Dress Pants', price: 180 },
  { id: 'slacks', category: 'Bottoms', label: 'Slacks', price: 180 },
  { id: 'pencil_skirt', category: 'Bottoms', label: 'Pencil Skirt', price: 150 },
  { id: 'long_skirt', category: 'Bottoms', label: 'Long Skirt', price: 180 },

  { id: 'barong_tagalog', category: 'Traditional Wear', label: 'Barong Tagalog', price: 180 },
  { id: 'filipiniana_dress', category: 'Traditional Wear', label: 'Filipiniana Dress', price: 400 },
  { id: 'kimono', category: 'Traditional Wear', label: 'Kimono', price: 350 },
  { id: 'hanbok', category: 'Traditional Wear', label: 'Hanbok', price: 500 },
  { id: 'saree', category: 'Traditional Wear', label: 'Saree', price: 450 },
  { id: 'abaya', category: 'Traditional Wear', label: 'Abaya', price: 350 },

  { id: 'denim_jacket', category: 'Outerwear', label: 'Denim Jacket', price: 220 },
  { id: 'bomber_jacket', category: 'Outerwear', label: 'Bomber Jacket', price: 250 },
  { id: 'leather_jacket', category: 'Outerwear', label: 'Leather Jacket', price: 700 },
  { id: 'suede_jacket', category: 'Outerwear', label: 'Suede Jacket', price: 800 },
  { id: 'wool_coat', category: 'Outerwear', label: 'Wool Coat', price: 500 },
  { id: 'trench_coat', category: 'Outerwear', label: 'Trench Coat', price: 550 },
  { id: 'winter_coat', category: 'Outerwear', label: 'Winter Coat', price: 600 },
  { id: 'down_jacket', category: 'Outerwear', label: 'Down Jacket', price: 650 },
  { id: 'raincoat', category: 'Outerwear', label: 'Raincoat', price: 250 },

  { id: 'leather_pants', category: 'Leather Items', label: 'Leather Pants', price: 700 },
  { id: 'leather_skirt', category: 'Leather Items', label: 'Leather Skirt', price: 500 },
  { id: 'leather_vest', category: 'Leather Items', label: 'Leather Vest', price: 400 },
  { id: 'leather_gloves', category: 'Leather Items', label: 'Leather Gloves', price: 250 },

  { id: 'silk_dress', category: 'Delicate Fabrics', label: 'Silk Dress', price: 350 },
  { id: 'velvet_dress', category: 'Delicate Fabrics', label: 'Velvet Dress', price: 400 },
  { id: 'satin_dress', category: 'Delicate Fabrics', label: 'Satin Dress', price: 350 },
  { id: 'lace_dress', category: 'Delicate Fabrics', label: 'Lace Dress', price: 350 },
  { id: 'chiffon_dress', category: 'Delicate Fabrics', label: 'Chiffon Dress', price: 350 },
  { id: 'cashmere_sweater', category: 'Delicate Fabrics', label: 'Cashmere Sweater', price: 350 },

  { id: 'school_blazer', category: 'Uniforms', label: 'School Blazer', price: 200 },
  { id: 'hotel_uniform', category: 'Uniforms', label: 'Hotel Uniform', price: 180 },
  { id: 'airline_uniform', category: 'Uniforms', label: 'Airline Uniform', price: 220 },
  { id: 'security_uniform', category: 'Uniforms', label: 'Security Uniform', price: 180 },
  { id: 'military_uniform', category: 'Uniforms', label: 'Military Uniform', price: 250 },
  { id: 'graduation_gown', category: 'Uniforms', label: 'Graduation Gown', price: 250 },
  { id: 'choir_robe', category: 'Uniforms', label: 'Choir Robe', price: 300 },

  { id: 'christening_gown', category: "Children's Wear", label: 'Christening Gown', price: 350 },
  { id: 'flower_girl_dress', category: "Children's Wear", label: 'Flower Girl Dress', price: 300 },
  { id: 'ring_bearer_suit', category: "Children's Wear", label: 'Ring Bearer Suit', price: 300 },

  { id: 'curtains_per_panel', category: 'Home Textiles', label: 'Curtains (per panel)', price: 250 },
  { id: 'sheer_curtain', category: 'Home Textiles', label: 'Sheer Curtain', price: 180 },
  { id: 'tablecloth', category: 'Home Textiles', label: 'Tablecloth', price: 250 },
  { id: 'chair_cover', category: 'Home Textiles', label: 'Chair Cover', price: 80 },
  { id: 'cushion_cover', category: 'Home Textiles', label: 'Cushion Cover', price: 60 },
  { id: 'decorative_pillow_cover', category: 'Home Textiles', label: 'Decorative Pillow Cover', price: 60 },
  { id: 'blanket', category: 'Home Textiles', label: 'Blanket', price: 350 },
  { id: 'comforter_single', category: 'Home Textiles', label: 'Comforter (Single)', price: 450 },
  { id: 'comforter_double', category: 'Home Textiles', label: 'Comforter (Double)', price: 600 },
  { id: 'comforter_queen', category: 'Home Textiles', label: 'Comforter (Queen)', price: 700 },
  { id: 'comforter_king', category: 'Home Textiles', label: 'Comforter (King)', price: 850 },
  { id: 'duvet', category: 'Home Textiles', label: 'Duvet', price: 700 },
  { id: 'quilt', category: 'Home Textiles', label: 'Quilt', price: 500 },
  { id: 'bedspread', category: 'Home Textiles', label: 'Bedspread', price: 450 },

  { id: 'necktie', category: 'Accessories', label: 'Necktie', price: 80 },
  { id: 'bow_tie', category: 'Accessories', label: 'Bow Tie', price: 60 },
  { id: 'scarf', category: 'Accessories', label: 'Scarf', price: 100 },
  { id: 'shawl', category: 'Accessories', label: 'Shawl', price: 150 },
  { id: 'pashmina', category: 'Accessories', label: 'Pashmina', price: 180 },
  { id: 'fabric_hat', category: 'Accessories', label: 'Fabric Hat', price: 150 },
  { id: 'pocket_square', category: 'Accessories', label: 'Pocket Square', price: 50 },
];

export const EXPRESS_RETURN_ADDON_ID = 'express_delivery';
/** Pickups starting at or after this hour (Asia/Manila) can't take the express-return add-on. */
export const EXPRESS_RETURN_CUTOFF_HOUR = 15;

/** Hour-of-day (0-23) of an ISO instant, read in Asia/Manila time regardless of the runtime's own timezone. */
function manilaHourOf(isoOrDate: string | Date): number {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return Number(
    date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }),
  );
}

/** Manila (UTC+8, no DST) wall-clock date/time parts of an instant, regardless of runtime timezone. */
function manilaParts(date: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const hour = get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
  };
}

/** A calendar date (as seen in Manila), independent of any instant or runtime timezone. */
interface ManilaDate {
  year: number;
  month: number;
  day: number;
}

function manilaDateKey(d: ManilaDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** Day-of-week (0=Sun..6=Sat) for a Manila calendar date. */
function manilaWeekday(d: ManilaDate): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

function addManilaDays(d: ManilaDate, days: number): ManilaDate {
  const utc = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

/** UTC instant for a given wall-clock hour/minute on a Manila calendar date (fixed UTC+8, no DST). */
function manilaWallTimeToUtc(d: ManilaDate, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(d.year, d.month - 1, d.day, hour - 8, minute));
}

/** No slot chosen yet → don't block add-on browsing prematurely. */
export function isExpressReturnAllowed(scheduledPickupAt?: string | null): boolean {
  if (!scheduledPickupAt) return true;
  return manilaHourOf(scheduledPickupAt) < EXPRESS_RETURN_CUTOFF_HOUR;
}


/** Marks up a partner shop's base price/kg by Lunara's cut, rounded to the nearest centavo. */
export function applyShopMarkup(basePricePerKg: number): number {
  return Math.round(basePricePerKg * SHOP_PRICE_MARKUP_MULTIPLIER * 100) / 100;
}

export function getService(type: BookingType) {
  return LAUNDRY_SERVICES.find((s) => s.type === type);
}

export function getAddon(id: string) {
  return BOOKING_ADDONS.find((a) => a.id === id);
}

export function normalizeAreaText(value: string) {
  return value.trim().toLowerCase();
}

const NCR_PROVINCE_ALIASES = new Set([
  'metro manila',
  'ncr',
  'national capital region',
  'manila',
]);

function isNcrProvince(province: string) {
  return NCR_PROVINCE_ALIASES.has(normalizeAreaText(province));
}

function cityMatches(areaCity: string, addressCity: string) {
  const area = normalizeAreaText(areaCity);
  const city = normalizeAreaText(addressCity);
  if (!area || !city) return false;
  return city === area || city.includes(area) || area.includes(city);
}

function provinceMatches(areaProvince: string, addressProvince: string) {
  const area = normalizeAreaText(areaProvince);
  const province = normalizeAreaText(addressProvince);
  if (area === province) return true;
  return isNcrProvince(area) && isNcrProvince(province);
}

/** Whether an address falls within a given service area's coverage (city, province, or postal
 * prefix match) — the shared matching rule used both by the admin-managed area lookup (server-side,
 * against DB-loaded areas) and any future callers that need the same semantics. */
export function areaMatchesAddress(
  area: Pick<ServiceAreaRule, 'cities' | 'provinces' | 'postalPrefixes'>,
  address: AddressInput,
): boolean {
  const postal = address.postalCode.trim();
  const cityMatch = area.cities.some((c) => cityMatches(c, address.city));
  const provinceMatch = area.provinces.some((p) => provinceMatches(p, address.province));
  const postalMatch = area.postalPrefixes.some((prefix) => postal.startsWith(prefix));
  return cityMatch || provinceMatch || postalMatch;
}

export function isServiceAvailableInArea(bookingType: BookingType, areaServices: BookingType[]) {
  return areaServices.length === 0 || areaServices.includes(bookingType);
}

export function validateAddressFields(address: AddressInput): { valid: boolean; message?: string } {
  if (!address.line1?.trim()) return { valid: false, message: 'Street address is required' };
  if (!address.city?.trim()) return { valid: false, message: 'City is required' };
  if (!address.province?.trim()) return { valid: false, message: 'Province is required' };
  if (!/^\d{3,10}$/.test(address.postalCode?.trim() ?? '')) {
    return { valid: false, message: 'Enter a valid postal code' };
  }
  return { valid: true };
}

export function calculateQuote(
  input: QuoteInput,
  serviceOverride?: LaundryServiceOption,
  addonOptions?: BookingAddonOption[],
  /** Resolved server-side per address (city vs. provincial tier); falls back to the flat default for client-side previews before the server confirms. */
  deliveryFeeOverride?: number,
  /** This shop's own garment price overrides (falls back to GARMENT_CATALOG when omitted). */
  garmentCatalog?: GarmentItem[],
): QuoteBreakdown {
  const service = serviceOverride ?? getService(input.bookingType);
  if (!service) throw new Error('Unknown service type');

  const garmentPriced = isGarmentPricedBookingType(input.bookingType) && !!input.garmentSelections?.length;

  const pricingMode = input.pricingMode ?? BranchPricingMode.FLAT_BAG;
  const bag = !garmentPriced && input.bagSizeId ? getBagSize(input.bagSizeId) : undefined;
  if (!garmentPriced && pricingMode === BranchPricingMode.FLAT_BAG && !bag) {
    throw new Error('Unknown bag size');
  }

  const weightKg = garmentPriced
    ? 0
    : pricingMode === BranchPricingMode.FLAT_BAG
      ? (bag?.capacityKg ?? 0)
      : (input.enteredWeightKg ?? 0);
  const kgPerLoad = input.kgPerLoad ?? BOOKING_MACHINE_LOAD_MIN_KG;
  // Always resolved regardless of the service's own mode — an add-on can bill per-load or
  // per-piece independently of how the base service itself is priced.
  const loadCount = input.enteredLoadCount ?? estimateMachineLoads(weightKg, kgPerLoad);
  const pieceCount = input.enteredPieceCount;

  const serviceSubtotal = garmentPriced
    ? computeGarmentSubtotal(input.garmentSelections ?? [], garmentCatalog ?? GARMENT_CATALOG)
    : computeServiceSubtotal(
        pricingMode,
        input.rates,
        {
          bag,
          weightKg,
          loadCount: pricingMode === BranchPricingMode.PER_LOAD ? loadCount : undefined,
          pieceCount: pricingMode === BranchPricingMode.PER_PIECE ? pieceCount : undefined,
        },
        kgPerLoad,
      );
  const catalog = addonOptions ?? BOOKING_ADDONS;
  const addons = input.addonIds
    .map((id) => catalog.find((a) => a.id === id))
    .filter((a): a is BookingAddonOption => !!a)
    .map((a) => {
      if (a.isPercentOfService) {
        const price = Math.round(serviceSubtotal * (a.price / 100) * 100) / 100;
        return { id: a.id, label: a.label, price, percent: a.price };
      }
      const unit = a.pricingUnit ?? BranchPricingMode.FLAT_BAG;
      const quantity =
        unit === BranchPricingMode.PER_KG
          ? weightKg
          : unit === BranchPricingMode.PER_LOAD
            ? loadCount
            : unit === BranchPricingMode.PER_PIECE ||
                unit === BranchPricingMode.PER_PAIR ||
                unit === BranchPricingMode.PER_ITEM
              ? (pieceCount ?? 0)
              : undefined;
      const addonQuantity =
        (unit === BranchPricingMode.FLAT_BAG || unit === BranchPricingMode.FIXED) && a.allowsQuantity
          ? Math.max(1, Math.min(input.addonQuantities?.[a.id] ?? 1, a.maxQuantity ?? 5))
          : 1;
      const price =
        unit === BranchPricingMode.FLAT_BAG || unit === BranchPricingMode.FIXED
          ? Math.round(a.price * addonQuantity * 100) / 100
          : Math.round(a.price * (quantity ?? 0) * 100) / 100;
      return { id: a.id, label: a.label, price, unit, quantity, addonQuantity };
    });
  const addonsSubtotal = addons.reduce((sum, a) => sum + a.price, 0);
  const subtotal = serviceSubtotal + addonsSubtotal;
  const deliveryFee = deliveryFeeOverride ?? BOOKING_FLAT_DELIVERY_FEE;
  const discount = 0;
  const total = subtotal + deliveryFee - discount;

  return {
    bookingType: input.bookingType,
    serviceLabel: service.label,
    bagSizeId: bag?.id ?? input.bagSizeId,
    bagLabel: bag?.label ?? '',
    weightKg,
    serviceSubtotal,
    addons,
    addonsSubtotal,
    subtotal,
    deliveryFee,
    discount,
    total,
    meetsMinimum: subtotal >= BOOKING_MIN_ORDER_AMOUNT,
    minimumOrderAmount: BOOKING_MIN_ORDER_AMOUNT,
    meetsWeightMinimum:
      garmentPriced ||
      pricingMode === BranchPricingMode.PER_PIECE ||
      pricingMode === BranchPricingMode.PER_PAIR ||
      pricingMode === BranchPricingMode.PER_ITEM ||
      pricingMode === BranchPricingMode.FIXED ||
      weightKg >= BOOKING_MIN_WEIGHT_KG,
    minimumWeightKg: BOOKING_MIN_WEIGHT_KG,
    pricingMode,
    garmentSelections: garmentPriced ? input.garmentSelections : undefined,
    pieceCount,
    isEstimate:
      !garmentPriced &&
      pricingMode !== BranchPricingMode.FLAT_BAG &&
      pricingMode !== BranchPricingMode.FIXED,
  };
}

/** How many orders may be scheduled into a single hourly pickup window before it's full, derived
 * from the branch's real daily order quota spread across its typical operating hours. */
export function estimateSlotCapacityPerHour(
  dailyQuotaOrders: number,
  operatingHours: OperatingHours = DEFAULT_OPERATING_HOURS,
): number {
  const openDayHourCounts = operatingHours
    .filter((d) => !d.isClosed)
    .map((d) => Math.max(1, Math.ceil(parseTimeToHour(d.closeTime)) - Math.floor(parseTimeToHour(d.openTime))));
  const avgHoursPerOpenDay =
    openDayHourCounts.length > 0
      ? openDayHourCounts.reduce((a, b) => a + b, 0) / openDayHourCounts.length
      : 9;
  return Math.max(1, Math.round(dailyQuotaOrders / avgHoursPerOpenDay));
}

/** Real booking pressure for validatePickupTime: how many orders are already scheduled into each
 * hourly window (keyed by that hour's UTC start ISO string), and how many a window can hold before
 * it's full. Omit entirely when there's no specific branch to check against yet (e.g. before a shop
 * is chosen) — times are then all treated as available rather than guessed at. */
export interface PickupSlotCapacity {
  perSlot: number;
  bookedBySlot: Record<string, number>;
}

export const PICKUP_SCHEDULE_DAY_COUNT = 7;

/** Minimum lead time before slot start when it becomes bookable. */
export const PICKUP_SLOT_MIN_LEAD_MS = 30 * 60 * 1000;

/** Fallback hours (every day, 8AM–5PM) used for branches/days with no configured hours. */
export const DEFAULT_OPERATING_HOURS: OperatingHours = Array.from({ length: 7 }, () => ({
  isClosed: false,
  openTime: '08:00',
  closeTime: '17:00',
}));

function parseTimeToHour(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + (Number.isFinite(m) ? m : 0) / 60;
}

function resolveDayHours(operatingHours: OperatingHours, dayOfWeek: number): DayOperatingHours {
  return operatingHours[dayOfWeek] ?? DEFAULT_OPERATING_HOURS[dayOfWeek];
}

export interface BranchHoliday {
  /** ISO date (YYYY-MM-DD) for a one-off holiday, or "MM-DD" when `recurring` is true. */
  date: string;
  label?: string;
  /** When true, `date` is "MM-DD" and recurs every year (e.g. a partner's own yearly closure). */
  recurring?: boolean;
  /** 'closed' (default) marks the date as a holiday. 'open' overrides a recurring/built-in
   * holiday to force the shop open on that specific date. */
  type?: 'closed' | 'open';
}

/** Built-in Philippine regular holidays with a fixed date, recurring every year. Movable holidays
 * (Holy Week, Lunar New Year, Eid, etc.) aren't included since their dates vary and would need a
 * yearly data source. Partners can force-open any of these for their branch by adding a
 * `{ date: 'MM-DD', recurring: true, type: 'open' }` entry to their own holidays list. */
export const PH_REGULAR_HOLIDAYS: BranchHoliday[] = [
  { date: '01-01', label: "New Year's Day", recurring: true },
  { date: '04-09', label: 'Araw ng Kagitingan', recurring: true },
  { date: '05-01', label: 'Labor Day', recurring: true },
  { date: '06-12', label: 'Independence Day', recurring: true },
  { date: '08-21', label: 'Ninoy Aquino Day', recurring: true },
  { date: '11-30', label: 'Bonifacio Day', recurring: true },
  { date: '12-25', label: 'Christmas Day', recurring: true },
  { date: '12-30', label: 'Rizal Day', recurring: true },
];

function monthDayKey(d: ManilaDate): string {
  return `${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function findHolidayForManilaDate(
  holidays: BranchHoliday[] | undefined,
  d: ManilaDate,
): BranchHoliday | undefined {
  const key = manilaDateKey(d);
  const mdKey = monthDayKey(d);
  const matches = (h: BranchHoliday) => (h.recurring ? h.date === mdKey : h.date === key);
  const combined = [...PH_REGULAR_HOLIDAYS, ...(holidays ?? [])];

  // A partner's 'open' override cancels out any closed match (built-in or their own) for the date.
  if (combined.some((h) => h.type === 'open' && matches(h))) return undefined;

  return combined.find((h) => (h.type ?? 'closed') === 'closed' && matches(h));
}

export interface TodayScheduleSummary {
  isOpenNow: boolean;
  /** e.g. "Open until 5:00 PM", "Closed today", "Closed for New Year's Day", "Opens 8:00 AM tomorrow". */
  label: string;
}

/** Today's open/closed status for a shop, holiday-aware — for "Open now" / "Closed today" badges
 * on shop cards. `now` defaults to the current time; pass a fixed Date in tests. */
export function getTodayScheduleSummary(
  operatingHours: OperatingHours = DEFAULT_OPERATING_HOURS,
  holidays: BranchHoliday[] = [],
  now: Date = new Date(),
): TodayScheduleSummary {
  const nowParts = manilaParts(now);
  const nowDate: ManilaDate = nowParts;

  const holiday = findHolidayForManilaDate(holidays, nowDate);
  if (holiday) {
    return { isOpenNow: false, label: holiday.label ? `Closed for ${holiday.label}` : 'Closed for holiday' };
  }

  const dayHours = resolveDayHours(operatingHours, manilaWeekday(nowDate));
  if (dayHours.isClosed) {
    return { isOpenNow: false, label: 'Closed today' };
  }

  const nowHour = nowParts.hour + nowParts.minute / 60;
  const openHour = parseTimeToHour(dayHours.openTime);
  const closeHour = parseTimeToHour(dayHours.closeTime);

  if (nowHour < openHour) {
    return { isOpenNow: false, label: `Opens ${formatHourLabel(Math.floor(openHour))} today` };
  }
  if (nowHour >= closeHour) {
    return { isOpenNow: false, label: 'Closed for today' };
  }
  return { isOpenNow: true, label: `Open until ${formatHourLabel(Math.ceil(closeHour))}` };
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

/** Like formatHourLabel, but preserves minutes for fractional hours (e.g. 8.5 -> "8:30 AM"). */
function formatDecimalHourLabel(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

function parseManilaDateKey(key: string): ManilaDate {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

/** Combines a YYYY-MM-DD Manila calendar date + "HH:mm" wall-clock time into the correct UTC ISO
 * instant for that moment in Asia/Manila, regardless of the runtime's own timezone. */
export function manilaDateAndTimeToIso(dateKey: string, time: string): string {
  const day = parseManilaDateKey(dateKey);
  const hour = Math.floor(parseTimeToHour(time));
  const minute = Math.round((parseTimeToHour(time) - hour) * 60);
  return manilaWallTimeToUtc(day, hour, minute).toISOString();
}

/** Bumps a day's opening time forward to respect the minimum pickup lead time, only relevant for
 * today (future days are never lead-time-constrained). Returns undefined if the whole remaining
 * day is inside the lead-time window (i.e. there's no bookable time left today). */
function earliestBookableTimeForDay(
  dayHours: DayOperatingHours,
  isToday: boolean,
  now: Date,
): string | undefined {
  const closeHour = parseTimeToHour(dayHours.closeTime);
  if (!isToday) return dayHours.openTime;

  const earliestInstant = new Date(now.getTime() + PICKUP_SLOT_MIN_LEAD_MS);
  const earliestParts = manilaParts(earliestInstant);
  const earliestHour = earliestParts.hour + earliestParts.minute / 60;
  const openHour = parseTimeToHour(dayHours.openTime);
  const boundedHour = Math.max(openHour, earliestHour);
  if (boundedHour >= closeHour) return undefined;

  // Round up to the next 15-minute mark so the suggested time is always itself bookable.
  const roundedMinutes = Math.ceil((boundedHour * 60) / 15) * 15;
  const h = Math.floor(roundedMinutes / 60);
  const m = roundedMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface PickupDayInfo {
  /** YYYY-MM-DD, Manila calendar date. */
  key: string;
  date: Date;
  weekday: string;
  dayLabel: string;
  monthLabel: string;
  isToday: boolean;
  /** Closed either for the recurring weekday, or a one-off holiday. */
  isClosed: boolean;
  holidayLabel?: string;
  openTime?: string;
  closeTime?: string;
  /** Earliest "HH:mm" bookable on this day (accounts for min lead time on today); undefined when
   * the day is closed, or (for today) there's no bookable time left before closing. */
  earliestBookableTime?: string;
}

/** Builds the day-picker strip data: which of the next `dayCount` days are open, closed, or
 * holidays, and each open day's hours — no pre-materialized time slots, just what a free-form
 * time picker needs to constrain and label its inputs. */
export function buildPickupDayOptions(
  operatingHours: OperatingHours = DEFAULT_OPERATING_HOURS,
  holidays: BranchHoliday[] = [],
  dayCount = PICKUP_SCHEDULE_DAY_COUNT,
  now: Date = new Date(),
): PickupDayInfo[] {
  const startDate: ManilaDate = manilaParts(now);
  const days: PickupDayInfo[] = [];

  for (let i = 0; i < dayCount; i++) {
    const day = addManilaDays(startDate, i);
    const instant = manilaWallTimeToUtc(day);
    const holiday = findHolidayForManilaDate(holidays, day);
    const dayHours = resolveDayHours(operatingHours, manilaWeekday(day));
    const isClosed = Boolean(holiday) || dayHours.isClosed;
    const isToday = i === 0;

    days.push({
      key: manilaDateKey(day),
      date: instant,
      weekday: instant.toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' }),
      dayLabel: String(day.day),
      monthLabel: instant.toLocaleDateString('en-PH', { month: 'short', timeZone: 'Asia/Manila' }),
      isToday,
      isClosed,
      holidayLabel: holiday ? (holiday.label ?? 'Holiday') : undefined,
      openTime: isClosed ? undefined : dayHours.openTime,
      closeTime: isClosed ? undefined : dayHours.closeTime,
      earliestBookableTime: isClosed ? undefined : earliestBookableTimeForDay(dayHours, isToday, now),
    });
  }

  return days;
}

export interface PickupTimeValidationResult {
  valid: boolean;
  reason?: 'invalid_input' | 'past' | 'lead_time' | 'holiday' | 'closed_day' | 'outside_hours' | 'capacity_full';
  message?: string;
  /** ISO start of the hour bucket this time falls into — used for capacity lookups. */
  hourBucketIso?: string;
}

/** Single source of truth for whether an arbitrary pickup timestamp is bookable: not in the past,
 * respects the minimum lead time, falls within that Manila day's operating hours, isn't a holiday,
 * and (when capacity data is supplied) hasn't hit the branch's real per-hour order cap. Shared by
 * server-side submission checks and client-side pre-flight validation (client omits `capacity`,
 * since only the server knows live booked counts — the server call is the real backstop). */
export function validatePickupTime(
  scheduledPickupAt: string,
  operatingHours: OperatingHours = DEFAULT_OPERATING_HOURS,
  holidays: BranchHoliday[] = [],
  now: Date = new Date(),
  capacity?: PickupSlotCapacity,
): PickupTimeValidationResult {
  const instant = new Date(scheduledPickupAt);
  if (Number.isNaN(instant.getTime())) {
    return { valid: false, reason: 'invalid_input', message: 'Invalid pickup time' };
  }
  if (instant.getTime() < now.getTime()) {
    return { valid: false, reason: 'past', message: 'That pickup time has already passed' };
  }
  if (instant.getTime() < now.getTime() + PICKUP_SLOT_MIN_LEAD_MS) {
    const minutes = Math.round(PICKUP_SLOT_MIN_LEAD_MS / 60000);
    return {
      valid: false,
      reason: 'lead_time',
      message: `Pickup must be at least ${minutes} minutes from now`,
    };
  }

  const day: ManilaDate = manilaParts(instant);
  const holiday = findHolidayForManilaDate(holidays, day);
  if (holiday) {
    return {
      valid: false,
      reason: 'holiday',
      message: holiday.label ? `Closed for ${holiday.label}` : 'Closed for holiday',
    };
  }

  const dayHours = resolveDayHours(operatingHours, manilaWeekday(day));
  if (dayHours.isClosed) {
    return { valid: false, reason: 'closed_day', message: 'Shop is closed that day' };
  }

  const instantParts = manilaParts(instant);
  const pickedHour = instantParts.hour + instantParts.minute / 60;
  const openHour = parseTimeToHour(dayHours.openTime);
  const closeHour = parseTimeToHour(dayHours.closeTime);
  if (pickedHour < openHour || pickedHour >= closeHour) {
    return {
      valid: false,
      reason: 'outside_hours',
      message: `Pickup must be between ${formatDecimalHourLabel(openHour)} and ${formatDecimalHourLabel(closeHour)}`,
    };
  }

  const hourBucketIso = manilaWallTimeToUtc(day, Math.floor(pickedHour), 0).toISOString();

  if (capacity) {
    const booked = capacity.bookedBySlot[hourBucketIso] ?? 0;
    if (booked >= capacity.perSlot) {
      return {
        valid: false,
        reason: 'capacity_full',
        message: 'That hour is fully booked — try a nearby time',
        hourBucketIso,
      };
    }
  }

  return { valid: true, hourBucketIso };
}
