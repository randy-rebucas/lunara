import { BookingType, type DayOperatingHours, type OperatingHours } from '@lunara/types';

export const BOOKING_MIN_ORDER_AMOUNT = 150;
/** @deprecated use BOOKING_FLAT_DELIVERY_FEE */
export const BOOKING_DELIVERY_FEE = 50;
/** Flat pickup + delivery fee charged on every booking. */
export const BOOKING_FLAT_DELIVERY_FEE = 70;
/** Lunara's markup on a partner shop's own add-on prices. Base service pricing is flat bag pricing
 * (see BAG_SIZES) and no longer uses this — add-ons still do. Single source of truth — never hardcode 1.30 elsewhere. */
export const SHOP_PRICE_MARKUP_MULTIPLIER = 1.3;

/** Minimum capacity per washing machine load (kg). */
export const BOOKING_MACHINE_LOAD_MIN_KG = 8;

export const BOOKING_MACHINE_LOAD_INFO =
  'Each machine holds up to 8 kg per load — every additional 8 kg (or part of it) counts as another load.';

/** Number of 8kg machine loads needed for a given weight, rounded up (min 1). Used both for
 * dispatch/display capacity estimates and — for PER_LOAD pricing — as the billed load count when
 * the customer/partner enters a weight instead of an explicit load count, so it must scale with
 * weight rather than cap out (a capped estimate would systematically underbill heavy orders). */
export function estimateMachineLoads(weightKg: number): number {
  if (weightKg <= 0) return 1;
  return Math.max(1, Math.ceil(weightKg / BOOKING_MACHINE_LOAD_MIN_KG));
}

export function formatMachineLoadLabel(weightKg: number): string {
  const loads = estimateMachineLoads(weightKg);
  return `${loads} machine load${loads === 1 ? '' : 's'}`;
}

export interface LaundryServiceOption {
  type: BookingType;
  label: string;
  description: string;
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
  { id: 'medium', label: 'Medium', capacityKg: 8, price: 349 },
  { id: 'large', label: 'Large', capacityKg: 12, price: 449 },
  { id: 'xl', label: 'XL', capacityKg: 15, price: 549 },
];

export function getBagSize(id: string): BagSizeOption | undefined {
  return BAG_SIZES.find((b) => b.id === id);
}

export interface BookingAddonOption {
  id: string;
  label: string;
  description: string;
  /** Flat total when pricingUnit is FLAT_BAG (or unset); otherwise the per-kg/load/piece rate. */
  price: number;
  pricingUnit?: BranchPricingMode;
  imageUrl?: string;
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

export interface PickupSlot {
  id: string;
  label: string;
  startAt: string;
  endAt: string;
  available: boolean;
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
}

/** Partner's own rates for the active pricing mode; branch-level, resolved server-side. */
export interface PricingModeRates {
  basePricePerKg?: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  minWeightKg?: number;
}

export interface QuoteInput {
  bookingType: BookingType;
  /** Required when pricingMode is FLAT_BAG (or omitted). */
  bagSizeId?: BagSizeId;
  addonIds: string[];
  /** Defaults to FLAT_BAG (today's behavior) when omitted. */
  pricingMode?: BranchPricingMode;
  /** Partner's per-kg/per-load/per-piece rates — required when pricingMode is PER_KG, PER_LOAD, or PER_PIECE. */
  rates?: PricingModeRates;
  /** Customer-entered weight — required for PER_KG, and used to derive load count for PER_LOAD if enteredLoadCount is omitted. */
  enteredWeightKg?: number;
  /** Customer-entered load count — required for PER_LOAD unless enteredWeightKg is provided instead. */
  enteredLoadCount?: number;
  /** Customer-entered piece count — required for PER_PIECE. */
  enteredPieceCount?: number;
}

/** Computes the base laundry service subtotal for a given pricing mode. Shared between booking-time
 * estimates and pickup-time finalization so both use identical math. */
export function computeServiceSubtotal(
  mode: BranchPricingMode,
  rates: PricingModeRates | undefined,
  qty: { bag?: BagSizeOption; weightKg?: number; loadCount?: number; pieceCount?: number },
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
      const loadCount = qty.loadCount ?? (qty.weightKg != null ? estimateMachineLoads(qty.weightKg) : 0);
      return Math.round(loadCount * perLoad * 100) / 100;
    }
    case BranchPricingMode.PER_PIECE: {
      const perPiece = rates?.basePricePerPiece;
      if (perPiece == null) throw new Error('Missing basePricePerPiece for PER_PIECE pricing mode');
      const pieceCount = qty.pieceCount ?? 0;
      return Math.round(pieceCount * perPiece * 100) / 100;
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
  /** `price` is the computed line total (already rate × quantity for non-flat units). `unit`/
   * `quantity` describe what that total was computed from, for display. */
  addons: { id: string; label: string; price: number; unit?: BranchPricingMode; quantity?: number }[];
  addonsSubtotal: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  meetsMinimum: boolean;
  minimumOrderAmount: number;
  couponCode?: string;
  promotionTitle?: string;
  pricingMode: BranchPricingMode;
  /** PER_PIECE orders only — piece count the subtotal was computed from. */
  pieceCount?: number;
  /** True when the base service price is provisional (PER_KG/PER_LOAD/PER_PIECE) and will be confirmed at pickup. */
  isEstimate: boolean;
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
): QuoteBreakdown {
  const service = serviceOverride ?? getService(input.bookingType);
  if (!service) throw new Error('Unknown service type');

  const pricingMode = input.pricingMode ?? BranchPricingMode.FLAT_BAG;
  const bag = input.bagSizeId ? getBagSize(input.bagSizeId) : undefined;
  if (pricingMode === BranchPricingMode.FLAT_BAG && !bag) throw new Error('Unknown bag size');

  const weightKg =
    pricingMode === BranchPricingMode.FLAT_BAG
      ? (bag?.capacityKg ?? 0)
      : (input.enteredWeightKg ?? 0);
  // Always resolved regardless of the service's own mode — an add-on can bill per-load or
  // per-piece independently of how the base service itself is priced.
  const loadCount = input.enteredLoadCount ?? estimateMachineLoads(weightKg);
  const pieceCount = input.enteredPieceCount;

  const serviceSubtotal = computeServiceSubtotal(pricingMode, input.rates, {
    bag,
    weightKg,
    loadCount: pricingMode === BranchPricingMode.PER_LOAD ? loadCount : undefined,
    pieceCount: pricingMode === BranchPricingMode.PER_PIECE ? pieceCount : undefined,
  });
  const catalog = addonOptions ?? BOOKING_ADDONS;
  const addons = input.addonIds
    .map((id) => catalog.find((a) => a.id === id))
    .filter((a): a is BookingAddonOption => !!a)
    .map((a) => {
      const unit = a.pricingUnit ?? BranchPricingMode.FLAT_BAG;
      const quantity =
        unit === BranchPricingMode.PER_KG
          ? weightKg
          : unit === BranchPricingMode.PER_LOAD
            ? loadCount
            : unit === BranchPricingMode.PER_PIECE
              ? (pieceCount ?? 0)
              : undefined;
      const price =
        unit === BranchPricingMode.FLAT_BAG
          ? a.price
          : Math.round(a.price * (quantity ?? 0) * 100) / 100;
      return { id: a.id, label: a.label, price, unit, quantity };
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
    pricingMode,
    pieceCount,
    isEstimate: pricingMode !== BranchPricingMode.FLAT_BAG,
  };
}

/** Deterministic slot capacity for demo schedule availability. */
function slotCapacityUsed(slotId: string) {
  let hash = 0;
  for (let i = 0; i < slotId.length; i++) hash = (hash + slotId.charCodeAt(i) * (i + 1)) % 100;
  return hash;
}

export const PICKUP_SCHEDULE_DAY_COUNT = 7;

/** Minimum lead time before slot start when it becomes bookable. */
export const PICKUP_SLOT_MIN_LEAD_MS = 30 * 60 * 1000;

export function isPickupSlotBookable(slot: PickupSlot, fromDate: Date = new Date()): boolean {
  if (!slot.available) return false;
  return new Date(slot.startAt).getTime() >= fromDate.getTime() + PICKUP_SLOT_MIN_LEAD_MS;
}

export function pickupSlotDayKey(isoOrDate: string | Date) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function groupPickupSlotsByDay(slots: PickupSlot[]) {
  const map = new Map<string, PickupSlot[]>();
  for (const slot of slots) {
    const key = pickupSlotDayKey(slot.startAt);
    const list = map.get(key) ?? [];
    list.push(slot);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
  return map;
}

export interface PickupScheduleDay {
  key: string;
  date: Date;
  weekday: string;
  dayLabel: string;
  monthLabel: string;
  isToday: boolean;
  slots: PickupSlot[];
  hasAvailable: boolean;
  /** Set when the shop is closed this day for a one-off holiday (as opposed to just having no
   * remaining bookable slots or being closed on this weekday recurringly). */
  holidayLabel?: string;
}

export function buildPickupScheduleDays(
  slots: PickupSlot[],
  fromDate: Date = new Date(),
  dayCount = PICKUP_SCHEDULE_DAY_COUNT,
  holidays: BranchHoliday[] = [],
): PickupScheduleDay[] {
  const byDay = groupPickupSlotsByDay(slots);
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const todayKey = pickupSlotDayKey(start);

  const days: PickupScheduleDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = pickupSlotDayKey(date);
    const daySlots = byDay.get(key) ?? [];
    const holiday = findHolidayForDate(holidays, date);
    days.push({
      key,
      date,
      weekday: date.toLocaleDateString('en-PH', { weekday: 'short' }),
      dayLabel: String(date.getDate()),
      monthLabel: date.toLocaleDateString('en-PH', { month: 'short' }),
      isToday: key === todayKey,
      slots: daySlots,
      hasAvailable: daySlots.some((s) => isPickupSlotBookable(s)),
      holidayLabel: holiday?.label ?? (holiday ? 'Holiday' : undefined),
    });
  }
  return days;
}

export function formatPickupSlotTimeWindow(slot: PickupSlot, locale = 'en-PH') {
  const start = new Date(slot.startAt);
  const end = new Date(slot.endAt);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString(locale, opts)} – ${end.toLocaleTimeString(locale, opts)}`;
}

/** First pickup window start hour (8:00 AM). */
export const PICKUP_WINDOW_START_HOUR = 8;
/** Last pickup window end hour (5:00 PM) — windows run hourly up to this. */
export const PICKUP_WINDOW_END_HOUR = 17;

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
  /** ISO date (YYYY-MM-DD), no time component. */
  date: string;
  label?: string;
}

/** YYYY-MM-DD for a Date, in local time (matches BranchHoliday.date format). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function findHolidayForDate(holidays: BranchHoliday[] | undefined, d: Date): BranchHoliday | undefined {
  if (!holidays?.length) return undefined;
  const key = dateKey(d);
  return holidays.find((h) => h.date === key);
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
  const holiday = findHolidayForDate(holidays, now);
  if (holiday) {
    return { isOpenNow: false, label: holiday.label ? `Closed for ${holiday.label}` : 'Closed for holiday' };
  }

  const dayHours = resolveDayHours(operatingHours, now.getDay());
  if (dayHours.isClosed) {
    return { isOpenNow: false, label: 'Closed today' };
  }

  const nowHour = now.getHours() + now.getMinutes() / 60;
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

function buildHourlyPickupWindows(startHour: number, endHour: number) {
  const windows: { start: number; end: number; label: string }[] = [];
  for (let h = startHour; h < endHour; h++) {
    windows.push({ start: h, end: h + 1, label: `${formatHourLabel(h)} – ${formatHourLabel(h + 1)}` });
  }
  return windows;
}

export function generatePickupSlots(
  fromDate: Date = new Date(),
  days = 7,
  operatingHours: OperatingHours = DEFAULT_OPERATING_HOURS,
  holidays: BranchHoliday[] = [],
): PickupSlot[] {
  const slots: PickupSlot[] = [];

  for (let d = 0; d < days; d++) {
    const day = new Date(fromDate);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + d);

    if (findHolidayForDate(holidays, day)) continue;

    const dayHours = resolveDayHours(operatingHours, day.getDay());
    if (dayHours.isClosed) continue;

    const startHour = Math.floor(parseTimeToHour(dayHours.openTime));
    const endHour = Math.ceil(parseTimeToHour(dayHours.closeTime));
    const windows = buildHourlyPickupWindows(startHour, endHour);

    for (const w of windows) {
      const start = new Date(day);
      start.setHours(w.start, 0, 0, 0);
      const end = new Date(day);
      end.setHours(w.end, 0, 0, 0);

      if (start.getTime() < fromDate.getTime() + PICKUP_SLOT_MIN_LEAD_MS) continue;

      const id = start.toISOString();
      const used = slotCapacityUsed(id);
      slots.push({
        id,
        label: `${day.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} · ${w.label}`,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        available: used < 85,
      });
    }
  }

  return slots;
}
