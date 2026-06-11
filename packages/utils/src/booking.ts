import { BookingType } from '@lunara/types';

export const BOOKING_MIN_ORDER_AMOUNT = 150;
export const BOOKING_DELIVERY_FEE = 50;
export const BOOKING_MIN_WEIGHT_KG = 1;
export const BOOKING_MAX_WEIGHT_KG = 50;
export const BOOKING_DEFAULT_WEIGHT_KG = 5;

/** Minimum capacity per washing machine load (kg). */
export const BOOKING_MACHINE_LOAD_MIN_KG = 8;

export const BOOKING_MACHINE_LOAD_INFO =
  'Each machine holds up to 8 kg per load. Under 8 kg counts as 1 load; over 8 kg counts as 2 loads.';

/** ≤8 kg = 1 load; >8 kg = 2 loads. */
export function estimateMachineLoads(weightKg: number): number {
  return weightKg <= BOOKING_MACHINE_LOAD_MIN_KG ? 1 : 2;
}

export function formatMachineLoadLabel(weightKg: number): string {
  const loads = estimateMachineLoads(weightKg);
  return `${loads} machine load${loads === 1 ? '' : 's'}`;
}

export interface LaundryServiceOption {
  type: BookingType;
  label: string;
  description: string;
  pricePerKg: number;
  minWeightKg: number;
}

export interface BookingAddonOption {
  id: string;
  label: string;
  description: string;
  price: number;
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

export interface QuoteInput {
  bookingType: BookingType;
  weightKg: number;
  addonIds: string[];
}

export interface QuoteBreakdown {
  bookingType: BookingType;
  serviceLabel: string;
  weightKg: number;
  pricePerKg: number;
  serviceSubtotal: number;
  addons: { id: string; label: string; price: number }[];
  addonsSubtotal: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  meetsMinimum: boolean;
  minimumOrderAmount: number;
  couponCode?: string;
  promotionTitle?: string;
}

export const LAUNDRY_SERVICES: LaundryServiceOption[] = [
  {
    type: BookingType.WASH_FOLD,
    label: 'Wash & Fold',
    description: 'Everyday clothes washed, dried, and folded',
    pricePerKg: 80,
    minWeightKg: 3,
  },
  {
    type: BookingType.WASH_DRY_FOLD,
    label: 'Wash, Dry & Fold',
    description: 'Full service including machine dry',
    pricePerKg: 120,
    minWeightKg: 3,
  },
  {
    type: BookingType.DRY_CLEANING,
    label: 'Dry Cleaning',
    description: 'Delicates, suits, and formal wear',
    pricePerKg: 200,
    minWeightKg: 2,
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

/** Metro Manila coverage for MVP. */
export const SERVICE_AREAS: ServiceAreaRule[] = [
  {
    id: 'metro-manila',
    label: 'Metro Manila',
    cities: [
      'Manila',
      'Makati',
      'Quezon City',
      'Pasig',
      'Taguig',
      'Mandaluyong',
      'San Juan',
      'Marikina',
      'Parañaque',
      'Las Piñas',
      'Muntinlupa',
      'Caloocan',
      'Valenzuela',
      'Pasay',
      'Pateros',
      'Navotas',
      'Malabon',
    ],
    provinces: ['Metro Manila', 'NCR', 'National Capital Region'],
    postalPrefixes: ['10', '11', '12', '13', '14', '15', '16', '17'],
    services: [
      BookingType.WASH_FOLD,
      BookingType.WASH_DRY_FOLD,
      BookingType.DRY_CLEANING,
    ],
  },
];

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

export function validateServiceArea(address: AddressInput): {
  valid: boolean;
  areaId?: string;
  areaLabel?: string;
  message?: string;
  availableServices: BookingType[];
} {
  const postal = address.postalCode.trim();

  for (const area of SERVICE_AREAS) {
    const cityMatch = area.cities.some((c) => cityMatches(c, address.city));
    const provinceMatch = area.provinces.some((p) => provinceMatches(p, address.province));
    const postalMatch = area.postalPrefixes.some((prefix) => postal.startsWith(prefix));

    if (cityMatch || provinceMatch || postalMatch) {
      return {
        valid: true,
        areaId: area.id,
        areaLabel: area.label,
        availableServices: area.services,
      };
    }
  }

  return {
    valid: false,
    message: 'Laundry pickup is not available in your area yet. Try a Metro Manila address.',
    availableServices: [],
  };
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

export function clampWeight(weightKg: number) {
  return Math.min(BOOKING_MAX_WEIGHT_KG, Math.max(BOOKING_MIN_WEIGHT_KG, weightKg));
}

export function calculateQuote(
  input: QuoteInput,
  serviceOverride?: LaundryServiceOption,
  addonOptions?: BookingAddonOption[],
): QuoteBreakdown {
  const service = serviceOverride ?? getService(input.bookingType);
  if (!service) throw new Error('Unknown service type');

  const weightKg = clampWeight(input.weightKg);
  const serviceSubtotal = Math.round(service.pricePerKg * weightKg);
  const catalog = addonOptions ?? BOOKING_ADDONS;
  const addons = input.addonIds
    .map((id) => catalog.find((a) => a.id === id))
    .filter((a): a is BookingAddonOption => !!a)
    .map((a) => ({ id: a.id, label: a.label, price: a.price }));
  const addonsSubtotal = addons.reduce((sum, a) => sum + a.price, 0);
  const subtotal = serviceSubtotal + addonsSubtotal;
  const deliveryFee = BOOKING_DELIVERY_FEE;
  const discount = 0;
  const total = subtotal + deliveryFee - discount;

  return {
    bookingType: input.bookingType,
    serviceLabel: service.label,
    weightKg,
    pricePerKg: service.pricePerKg,
    serviceSubtotal,
    addons,
    addonsSubtotal,
    subtotal,
    deliveryFee,
    discount,
    total,
    meetsMinimum: subtotal >= BOOKING_MIN_ORDER_AMOUNT,
    minimumOrderAmount: BOOKING_MIN_ORDER_AMOUNT,
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
}

export function buildPickupScheduleDays(
  slots: PickupSlot[],
  fromDate: Date = new Date(),
  dayCount = PICKUP_SCHEDULE_DAY_COUNT,
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
    days.push({
      key,
      date,
      weekday: date.toLocaleDateString('en-PH', { weekday: 'short' }),
      dayLabel: String(date.getDate()),
      monthLabel: date.toLocaleDateString('en-PH', { month: 'short' }),
      isToday: key === todayKey,
      slots: daySlots,
      hasAvailable: daySlots.some((s) => isPickupSlotBookable(s)),
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

export function generatePickupSlots(fromDate: Date = new Date(), days = 7): PickupSlot[] {
  const slots: PickupSlot[] = [];
  const windows = [
    { start: 8, end: 10, label: '8:00 AM – 10:00 AM' },
    { start: 10, end: 12, label: '10:00 AM – 12:00 PM' },
    { start: 13, end: 15, label: '1:00 PM – 3:00 PM' },
    { start: 15, end: 17, label: '3:00 PM – 5:00 PM' },
    { start: 17, end: 19, label: '5:00 PM – 7:00 PM' },
  ];

  for (let d = 0; d < days; d++) {
    const day = new Date(fromDate);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + d);

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
