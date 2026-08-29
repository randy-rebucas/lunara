import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressType, BookingType, PaymentMethod, type OperatingHours } from '@lunara/types';
import {
  BOOKING_MACHINE_LOAD_MIN_KG,
  BOOKING_MAX_WEIGHT_KG,
  BOOKING_MIN_ORDER_AMOUNT,
  BOOKING_PER_KG_MIN_KG,
  resolvePerKgMaxKg,
  BranchPricingMode,
  estimateMachineLoads,
  EXPRESS_RETURN_ADDON_ID,
  formatMachineLoadLabel,
  machineLoadInfo,
  calculateQuote,
  formatCurrency,
  formatAddressTypeLabel,
  isExpressReturnAllowed,
  getTodayScheduleSummary,
  getGarmentCategories,
  GARMENT_CATALOG,
  isGarmentPricedBookingType,
  recommendBagForWeight,
  type BagSizeId,
  type BagSizeOption,
  type BookingAddonOption,
  type BranchHoliday,
  type CashTiming,
  type GarmentItem,
  type GarmentSelection,
  type LaundryServiceOption,
  type QuoteBreakdown,
  validatePickupTime,
} from '@lunara/utils';
import { resolveMediaUrl } from '../src/lib/media-url';
import { brandName, colors, radius, shadow, spacing, typography } from '../src/theme';
import { BookingProgress } from '../src/components/booking-progress';
import { Button } from '../src/components/ui/button';
import { ScheduleSupportPrompt } from '../src/components/schedule-support-prompt';
import { PickupSchedulePicker } from '../src/components/pickup-schedule-picker';
import { BranchPickerSheet } from '../src/components/branch-picker-sheet';
import { PaymentMethodPicker } from '../src/components/payment-method-picker';
import { getCustomerClientOrigin } from '../src/lib/client-origin';
import {
  initialBookingForm,
  nextStep,
  prevStep,
  type BookingFormState,
  type BookingStep,
} from '../src/lib/booking-flow';
import { useAuthStore, getPartnerId } from '../src/store/auth';

interface ReorderSourceOrder {
  _id: string;
  branchId?: string;
  bookingType: BookingType;
  bagSizeId?: string;
  addons?: { id: string; quantity?: number }[];
  pickupAddressId?: string;
}

interface AddressOption {
  _id: string;
  label: string;
  addressType?: string;
  line1: string;
  city: string;
  province: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

function addressHasCoords(address?: AddressOption | null) {
  return address?.latitude != null && address?.longitude != null;
}

function StepHeading({ step, title }: { step: BookingStep; title: string }) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingIcon}>
        <Ionicons name={STEP_ICON[step]} size={16} color={colors.primary} />
      </View>
      <Text style={styles.heading}>{title}</Text>
    </View>
  );
}

/** Drag-to-estimate weight slider for the PER_KG/PER_LOAD detail steps — replaces the numeric
 * keyboard entry. Caps the visible track at maxKg, but a value already above it (e.g. from a
 * previous larger estimate) still displays correctly, just pinned at the far end of the track. */
function WeightSlider({
  value,
  maxKg,
  onChange,
}: {
  value: string;
  maxKg: number;
  onChange: (raw: string) => void;
}) {
  const weight = Number(value) || 0;
  return (
    <View>
      <Slider
        minimumValue={0}
        maximumValue={maxKg}
        step={0.5}
        value={Math.min(weight, maxKg)}
        onValueChange={(v) => onChange(v > 0 ? String(v) : '')}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
        style={styles.weightSlider}
      />
      <View style={styles.weightSliderLabels}>
        <Text style={styles.weightSliderLabelText}>0 kg</Text>
        <Text style={styles.weightSliderLabelText}>
          {weight > maxKg ? `${weight} kg` : `${maxKg}+ kg`}
        </Text>
      </View>
    </View>
  );
}

interface BookingConfig {
  services: LaundryServiceOption[];
  addons: BookingAddonOption[];
  minOrderAmount: number;
  bagSizes: BagSizeOption[];
}

interface ShopServiceOption {
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

interface ShopAddonOption {
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
}

/** Every other branch in the same partner's group carries the same full shape as the group's
 * headline shop (pricing, schedule, withinRadius, capacity) — see findNearbyShopsWithPricing. */
type ShopBranchVariant = Omit<ShopOption, 'mainShopId' | 'branches'>;

interface ShopOption {
  branchId: string;
  partnerUserId: string;
  mainShopId: string;
  isMainShop: boolean;
  code: string;
  name: string;
  city: string;
  distanceKm: number;
  distanceLabel: string;
  withinRadius: boolean;
  /** Platform-wide delivery ceiling (default 15km) — beyond this, checkout always rejects the
   * order regardless of branch, so this must gate selectability, not just styling. */
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

const STEP_ICON: Record<BookingStep, keyof typeof Ionicons.glyphMap> = {
  service: 'shirt-outline',
  address: 'location-outline',
  shop: 'storefront-outline',
  schedule: 'calendar-outline',
  weight: 'scale-outline',
  addons: 'sparkles-outline',
  review: 'receipt-outline',
  confirm: 'checkmark-circle-outline',
};

const ADDON_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  fabric_softener: 'water-outline',
  stain_treatment: 'color-wand-outline',
  eco_wash: 'leaf-outline',
  express_delivery: 'flash-outline',
};
const ADDON_ICON_FALLBACK: keyof typeof Ionicons.glyphMap = 'pricetag-outline';

/** Non-empty garmentSelections payload for garment-priced booking types, else undefined. */
function buildGarmentSelectionsPayload(form: BookingFormState): GarmentSelection[] | undefined {
  if (!form.bookingType || !isGarmentPricedBookingType(form.bookingType)) return undefined;
  const selections = Object.entries(form.garmentQuantities)
    .map(([garmentId, qty]) => ({ garmentId, quantity: Number(qty) || 0 }))
    .filter((sel) => sel.quantity > 0);
  return selections.length > 0 ? selections : undefined;
}

// Services on the same shop can each bill in a different unit, so "cheapest" is computed
// per-service in its own unit, not one shop-wide unit.
function startingPriceLabelFor(
  shop: Pick<ShopOption, 'services'>,
  flatBagFrom: number | undefined,
): string | null {
  const candidates = shop.services
    .map((s) => {
      const unit = s.pricingUnit ?? BranchPricingMode.FLAT_BAG;
      if (unit === BranchPricingMode.PER_LOAD && s.customerPricePerLoad != null) {
        return { amount: s.customerPricePerLoad, suffix: ' / load' };
      }
      if (unit === BranchPricingMode.PER_PIECE && s.customerPricePerPiece != null) {
        return { amount: s.customerPricePerPiece, suffix: ' / piece' };
      }
      if (unit === BranchPricingMode.PER_PAIR && s.customerPricePerPair != null) {
        return { amount: s.customerPricePerPair, suffix: ' / pair' };
      }
      if (unit === BranchPricingMode.PER_ITEM && s.customerPricePerItem != null) {
        return { amount: s.customerPricePerItem, suffix: ' / item' };
      }
      if (unit === BranchPricingMode.FIXED && s.customerFixedPrice != null) {
        return { amount: s.customerFixedPrice, suffix: '' };
      }
      if (unit === BranchPricingMode.FLAT_BAG && flatBagFrom != null) {
        return { amount: flatBagFrom, suffix: '' };
      }
      if (unit === BranchPricingMode.PER_KG) {
        return { amount: s.customerPricePerKg, suffix: ' / kg' };
      }
      return null;
    })
    .filter((c): c is { amount: number; suffix: string } => c != null);
  const cheapest = candidates.reduce<{ amount: number; suffix: string } | null>(
    (min, c) => (!min || c.amount < min.amount ? c : min),
    null,
  );
  return cheapest ? `From ${formatCurrency(cheapest.amount)}${cheapest.suffix}` : null;
}

export default function BookScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { service: serviceParam, code: codeParam, reorder: reorderParam } = useLocalSearchParams<{
    service?: string;
    code?: string;
    reorder?: string;
  }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [step, setStep] = useState<BookingStep>('address');
  const [form, setForm] = useState<BookingFormState>(() => {
    const initial = { ...initialBookingForm };
    if (serviceParam && Object.values(BookingType).includes(serviceParam as BookingType)) {
      initial.bookingType = serviceParam as BookingType;
    }
    if (codeParam?.trim()) {
      initial.couponCode = codeParam.trim().toUpperCase();
    }
    return initial;
  });
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null);
  const [holidays, setHolidays] = useState<BranchHoliday[]>([]);
  const [serverNow, setServerNow] = useState<string | undefined>(undefined);
  const [areaLabel, setAreaLabel] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [favoriteBranchIds, setFavoriteBranchIds] = useState<Set<string>>(new Set());
  const [branchSheetShopId, setBranchSheetShopId] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.GCASH);
  const [cashTiming, setCashTiming] = useState<CashTiming>('pickup');
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const placingOrderRef = useRef(false);
  const [error, setError] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const [addressesError, setAddressesError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [reorderNotice, setReorderNotice] = useState('');
  const reorderAppliedRef = useRef(false);
  const pendingRebookBranchRef = useRef<string | null>(null);

  useEffect(() => {
    setConfigLoading(true);
    apiFetch<BookingConfig>('/booking/config')
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load services'))
      .finally(() => setConfigLoading(false));
    apiFetch<AddressOption[]>('/addresses')
      .then((list) => {
        setAddresses(list);
        const defaultAddress = list.find((a) => a.isDefault) ?? list[0];
        if (defaultAddress && !reorderParam) setForm((f) => ({ ...f, addressId: defaultAddress._id }));
        setAddressesError('');
      })
      .catch((e) =>
        setAddressesError(e instanceof Error ? e.message : 'Could not load addresses'),
      );
    apiFetch<{ branchId: string }[]>('/favorites')
      .then((list) => setFavoriteBranchIds(new Set(list.map((f) => f.branchId))))
      .catch(() => {});
  }, [apiFetch, reorderParam]);

  async function toggleFavoriteBranch(branchId: string) {
    const isFavorited = favoriteBranchIds.has(branchId);
    setFavoriteBranchIds((prev) => {
      const next = new Set(prev);
      if (isFavorited) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
    try {
      if (isFavorited) {
        await apiFetch(`/favorites/${branchId}`, { method: 'DELETE' });
      } else {
        await apiFetch('/favorites', { method: 'POST', body: JSON.stringify({ branchId }) });
      }
    } catch {
      setFavoriteBranchIds((prev) => {
        const next = new Set(prev);
        if (isFavorited) next.add(branchId);
        else next.delete(branchId);
        return next;
      });
    }
  }

  // "Reorder" from order history: prefill the same shop, service, bag size, and add-ons once
  // addresses have loaded (needed to check the order's old pickup address is still valid).
  useEffect(() => {
    if (!reorderParam || reorderAppliedRef.current || addresses.length === 0) return;
    reorderAppliedRef.current = true;
    apiFetch<ReorderSourceOrder>(`/orders/${reorderParam}`)
      .then((order) => {
        const addressStillValid = addresses.some((a) => a._id === order.pickupAddressId);
        setForm((f) => ({
          ...f,
          bookingType: order.bookingType,
          bagSizeId: (order.bagSizeId as BagSizeId | undefined) ?? f.bagSizeId,
          addonIds: order.addons?.map((a) => a.id) ?? [],
          addonQuantities: Object.fromEntries(
            (order.addons ?? []).map((a) => [a.id, a.quantity ?? 1]),
          ),
          addressId: addressStillValid && order.pickupAddressId ? order.pickupAddressId : f.addressId,
          branchId: order.branchId ?? '',
          autoDispatch: false,
        }));
        if (order.branchId) pendingRebookBranchRef.current = order.branchId;
        if (!addressStillValid) {
          setReorderNotice(
            "We prefilled your last order, but its pickup address is no longer available — please choose one.",
          );
        }
      })
      .catch(() =>
        setReorderNotice('Could not load your previous order. Please build a new booking.'),
      );
  }, [reorderParam, addresses, apiFetch]);

  // Once shops for the (re-)resolved address have loaded, confirm the rebooked shop is still
  // available before letting the customer skip past the shop step with a stale selection.
  useEffect(() => {
    if (!pendingRebookBranchRef.current || shopsLoading) return;
    const rebookBranchId = pendingRebookBranchRef.current;
    pendingRebookBranchRef.current = null;
    const stillAvailable = shopOptions.some(
      (s) => s.branchId === rebookBranchId && s.withinRadius && s.capacityAvailable,
    );
    if (!stillAvailable) {
      setForm((f) => (f.branchId === rebookBranchId ? { ...f, branchId: '' } : f));
      setReorderNotice(
        `Your previous shop isn't available right now — choose another or let ${brandName} pick one for you.`,
      );
    }
  }, [shopOptions, shopsLoading]);

  // A partner's other branches are listed under `shop.branches[]`, keyed by the nearest branch's
  // id (`shop.branchId`) — picking a non-nearest variant via BranchPickerSheet still needs to
  // resolve back to that shop's pricing/services (the API doesn't expose per-variant pricing).
  const selectedShop = shopOptions.find(
    (s) => s.branchId === form.branchId || s.branches.some((b) => b.branchId === form.branchId),
  );
  // The customer may have picked a non-nearest branch variant via BranchPickerSheet — that
  // variant carries its own name/city, so anything shown to the customer must reflect it rather
  // than falling back to the parent shop's nearest-branch name.
  const selectedBranch: ShopOption | ShopBranchVariant | undefined = selectedShop
    ? selectedShop.branchId === form.branchId
      ? selectedShop
      : (selectedShop.branches.find((b) => b.branchId === form.branchId) ?? selectedShop)
    : undefined;
  const shopKgPerLoad = selectedShop?.kgPerLoad ?? BOOKING_MACHINE_LOAD_MIN_KG;

  const services = useMemo(() => {
    if (selectedShop) {
      return selectedShop.services.map((s) => {
        const catalogMatch = config?.services.find((cs) => cs.type === s.type);
        return {
          type: s.type,
          label: s.label,
          description: s.description ?? catalogMatch?.description ?? '',
          pricePerKg: s.customerPricePerKg,
          basePricePerLoad: s.customerPricePerLoad,
          basePricePerPiece: s.customerPricePerPiece,
          basePricePerPair: s.customerPricePerPair,
          basePricePerItem: s.customerPricePerItem,
          fixedPrice: s.customerFixedPrice,
          pricingUnit: s.pricingUnit ?? (s.isCustom ? BranchPricingMode.PER_KG : BranchPricingMode.FLAT_BAG),
          minWeightKg: catalogMatch?.minWeightKg ?? 5,
          isCustom: s.isCustom ?? false,
          customServiceId: s.customServiceId,
        };
      });
    }
    return (config?.services ?? []).map((s) => ({
      ...s,
      basePricePerLoad: undefined,
      basePricePerPiece: undefined,
      basePricePerPair: undefined,
      basePricePerItem: undefined,
      fixedPrice: undefined,
      pricingUnit: BranchPricingMode.FLAT_BAG,
      isCustom: false,
      customServiceId: undefined,
    }));
  }, [config, selectedShop]);

  const addons = useMemo(() => {
    // Percent-of-service add-ons (Express/Same-Day) are order-level, not scoped to any specific
    // service — always shown regardless of applicableServiceTypes.
    const appliesToSelection = (applicableServiceTypes?: string[], isPercentOfService?: boolean) =>
      isPercentOfService ||
      !form.bookingType ||
      !!applicableServiceTypes?.includes(form.bookingType);
    if (selectedShop) {
      return selectedShop.addons
        .filter((a) => appliesToSelection(a.applicableServiceTypes, a.isPercentOfService))
        .map((a) => {
          const catalogMatch = config?.addons.find((ca) => ca.id === a.slug);
          return {
            id: a.slug,
            label: a.label,
            description: a.description ?? catalogMatch?.description ?? '',
            price: a.customerPrice,
            pricingUnit: a.pricingUnit ?? BranchPricingMode.FLAT_BAG,
            isPercentOfService: a.isPercentOfService,
            imageUrl: catalogMatch?.imageUrl,
            isCustom: a.isCustom ?? false,
            allowsQuantity: a.allowsQuantity ?? catalogMatch?.allowsQuantity,
            maxQuantity: a.maxQuantity ?? catalogMatch?.maxQuantity,
          };
        });
    }
    return (config?.addons ?? []).map((a) => ({
      ...a,
      pricingUnit: BranchPricingMode.FLAT_BAG,
      isCustom: false,
    }));
  }, [config, selectedShop, form.bookingType]);

  // Add-ons a partner connected to the selected service are pre-checked for the customer (still
  // removable) the first time they appear — tracked in a ref so a manual uncheck sticks afterward.
  const autoAddedAddonIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const connectedIds = addons.filter((a) => !a.isPercentOfService).map((a) => a.id);
    const newlyConnected = connectedIds.filter((id) => !autoAddedAddonIdsRef.current.has(id));
    if (newlyConnected.length === 0) return;
    newlyConnected.forEach((id) => autoAddedAddonIdsRef.current.add(id));
    setForm((f) => {
      const toAdd = newlyConnected.filter((id) => !f.addonIds.includes(id));
      return toAdd.length === 0 ? f : { ...f, addonIds: [...f.addonIds, ...toAdd] };
    });
  }, [addons]);

  useEffect(() => {
    setForm((f) => {
      const validIds = new Set(addons.map((a) => a.id));
      const pruned = f.addonIds.filter((id) => validIds.has(id));
      return pruned.length === f.addonIds.length ? f : { ...f, addonIds: pruned };
    });
  }, [addons]);

  // Each service on a shop can bill in its own unit now, so this must be resolved per selected
  // service (and re-derived whenever bookingType/customServiceId changes), not once per shop.
  // Custom services are always priced per-kg (see partner-web services page).
  const selectedShopService = form.customServiceId
    ? selectedShop?.services.find((s) => s.customServiceId === form.customServiceId)
    : selectedShop?.services.find((s) => s.type === form.bookingType && !s.isCustom);
  const shopPricingMode =
    selectedShopService?.pricingUnit ??
    (form.customServiceId ? BranchPricingMode.PER_KG : BranchPricingMode.FLAT_BAG);

  const localQuote = useMemo(() => {
    if (!form.bookingType) return null;
    const catalogService = config?.services.find((s) => s.type === form.bookingType);
    const shopService = selectedShopService;
    const service =
      catalogService && shopService ? { ...catalogService, label: shopService.label } : catalogService;

    const enteredWeightKg = Number(form.enteredWeightKg) || undefined;
    const enteredLoadCount = Number(form.enteredLoadCount) || undefined;
    const enteredPieceCount = Number(form.enteredPieceCount) || undefined;
    const garmentPriced = isGarmentPricedBookingType(form.bookingType);
    const garmentSelections: GarmentSelection[] = garmentPriced
      ? Object.entries(form.garmentQuantities)
          .map(([garmentId, qty]) => ({ garmentId, quantity: Number(qty) || 0 }))
          .filter((sel) => sel.quantity > 0)
      : [];

    if (garmentPriced) {
      if (garmentSelections.length === 0) return null;
    } else if (shopPricingMode === BranchPricingMode.FLAT_BAG) {
      if (!form.bagSizeId) return null;
    } else if (shopPricingMode === BranchPricingMode.FIXED) {
      // No customer input needed — the price is fixed regardless of quantity.
    } else if (shopPricingMode === BranchPricingMode.PER_KG) {
      if (!enteredWeightKg) return null;
    } else if (
      shopPricingMode === BranchPricingMode.PER_PIECE ||
      shopPricingMode === BranchPricingMode.PER_PAIR ||
      shopPricingMode === BranchPricingMode.PER_ITEM
    ) {
      if (!enteredPieceCount) return null;
    } else if (!enteredWeightKg && !enteredLoadCount) {
      return null;
    }

    // Shop-specific addon prices/units when a shop is chosen — falls back to the flat global
    // catalog before a shop is picked, matching the `addons` render list below.
    const addonOptions = selectedShop
      ? selectedShop.addons.map((a) => ({
          id: a.slug,
          label: a.label,
          description: a.description ?? '',
          price: a.customerPrice,
          pricingUnit: a.pricingUnit ?? BranchPricingMode.FLAT_BAG,
          isPercentOfService: a.isPercentOfService,
          allowsQuantity: a.allowsQuantity,
          maxQuantity: a.maxQuantity,
        }))
      : config?.addons;

    try {
      return calculateQuote(
        {
          bookingType: form.bookingType,
          bagSizeId: form.bagSizeId || undefined,
          addonIds: form.addonIds,
          pricingMode: shopPricingMode,
          // Local preview must price off what the customer actually pays, not the partner's raw
          // rate, or this preview would undercount versus the real order total.
          rates: {
            basePricePerKg: shopService?.customerPricePerKg,
            basePricePerLoad: shopService?.customerPricePerLoad,
            basePricePerPiece: shopService?.customerPricePerPiece,
            basePricePerPair: shopService?.customerPricePerPair,
            basePricePerItem: shopService?.customerPricePerItem,
            fixedPrice: shopService?.customerFixedPrice,
          },
          enteredWeightKg,
          enteredLoadCount,
          enteredPieceCount,
          garmentSelections,
          kgPerLoad: shopKgPerLoad,
          addonQuantities: form.addonQuantities,
        },
        service,
        addonOptions,
      );
    } catch {
      return null;
    }
  }, [
    form.bookingType,
    form.customServiceId,
    form.bagSizeId,
    form.enteredWeightKg,
    form.enteredLoadCount,
    form.enteredPieceCount,
    form.garmentQuantities,
    form.addonIds,
    form.addonQuantities,
    config?.services,
    config?.addons,
    selectedShop,
    selectedShopService,
    shopKgPerLoad,
    shopPricingMode,
  ]);

  const loadAvailability = useCallback(
    async (addressId: string, branchId?: string) => {
      setAvailabilityError('');
      setAvailabilityLoading(true);
      try {
        const branchParam = branchId ? `&branchId=${encodeURIComponent(branchId)}` : '';
        const avail = await apiFetch<{
          areaLabel: string;
          operatingHours: OperatingHours;
          holidays?: BranchHoliday[];
          serverNow?: string;
          dispatchNote?: string;
        }>(`/booking/availability?addressId=${encodeURIComponent(addressId)}${branchParam}`);
        setAreaLabel(avail.areaLabel);
        setOperatingHours(avail.operatingHours);
        setHolidays(avail.holidays ?? []);
        setServerNow(avail.serverNow);
        setDispatchNote(avail.dispatchNote ?? '');
        setForm((f) => {
          const stillValid =
            f.scheduledPickupAt &&
            validatePickupTime(f.scheduledPickupAt, avail.operatingHours, avail.holidays ?? []).valid;
          return stillValid ? f : { ...f, scheduledPickupAt: '' };
        });
      } catch (e) {
        setAvailabilityError(
          e instanceof Error ? e.message : 'Could not load pickup schedule',
        );
        setOperatingHours(null);
        setAreaLabel('');
      } finally {
        setAvailabilityLoading(false);
      }
    },
    [apiFetch],
  );

  const loadShops = useCallback(
    async (addressId: string) => {
      setShopsLoading(true);
      try {
        const res = await apiFetch<ShopOption[]>(
          `/booking/shops?addressId=${encodeURIComponent(addressId)}`,
        );
        // A white-labeled partner build only ever books that partner's own shop (the API
        // force-resolves to it regardless of branchId — see buildQuote's partnerContextId
        // handling), so surfacing other partners' shops here would just be misleading.
        const partnerId = getPartnerId();
        const all = res ?? [];
        const partnerShops = partnerId ? all.filter((s) => s.partnerUserId === partnerId) : all;
        // If this partner has no shops assigned yet, an empty list is worse than showing the
        // full network — fall back to the default (unfiltered) behavior rather than a dead end.
        setShopOptions(partnerId && partnerShops.length === 0 ? all : partnerShops);
      } catch {
        setShopOptions([]);
      } finally {
        setShopsLoading(false);
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    if (!form.addressId) return;
    loadAvailability(form.addressId);
    loadShops(form.addressId);
    // Reset when the address changes — the branch-scoped effect below re-applies
    // form.branchId once a shop is (re)selected for the new address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.addressId]);

  // Once a specific shop is chosen, pickup slots must reflect that shop's own hours instead of
  // the network-wide union offered before a shop was picked — otherwise a slot can look bookable
  // here but get rejected at checkout once validated against the actual shop's operatingHours.
  useEffect(() => {
    if (!form.addressId || form.autoDispatch) return;
    if (!form.branchId) return;
    loadAvailability(form.addressId, form.branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.branchId, form.autoDispatch]);

  useEffect(() => {
    if (step !== 'confirm') return;
    apiFetch<{ balance: number }>('/wallets/me')
      .then((data) => setWalletBalance(data.balance))
      .catch(() => setWalletBalance(0));
  }, [apiFetch, step]);

  const expressReturnAllowed = isExpressReturnAllowed(form.scheduledPickupAt);

  useEffect(() => {
    if (expressReturnAllowed) return;
    setForm((f) =>
      f.addonIds.includes(EXPRESS_RETURN_ADDON_ID)
        ? { ...f, addonIds: f.addonIds.filter((id) => id !== EXPRESS_RETURN_ADDON_ID) }
        : f,
    );
  }, [expressReturnAllowed]);

  async function refreshQuote(couponCode = form.couponCode) {
    if (!form.bookingType || !form.addressId || (!form.branchId && !form.autoDispatch)) return null;
    const q = await apiFetch<QuoteBreakdown>(
      `/booking/quote?addressId=${encodeURIComponent(form.addressId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          services: [
            {
              bookingType: form.bookingType,
              ...(form.customServiceId ? { customServiceId: form.customServiceId } : {}),
              ...(form.bagSizeId ? { bagSizeId: form.bagSizeId } : {}),
              ...(Number(form.enteredWeightKg) ? { enteredWeightKg: Number(form.enteredWeightKg) } : {}),
              ...(Number(form.enteredLoadCount) ? { enteredLoadCount: Number(form.enteredLoadCount) } : {}),
              ...(Number(form.enteredPieceCount) ? { enteredPieceCount: Number(form.enteredPieceCount) } : {}),
              ...(buildGarmentSelectionsPayload(form) ? { garmentSelections: buildGarmentSelectionsPayload(form) } : {}),
            },
          ],
          ...(form.branchId ? { branchId: form.branchId } : {}),
          addonIds: form.addonIds,
          addonQuantities: form.addonQuantities,
          ...(form.scheduledPickupAt ? { scheduledPickupAt: form.scheduledPickupAt } : {}),
          ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        }),
      },
    );
    setQuote(q);
    return q;
  }

  async function applyPromoCode() {
    setPromoLoading(true);
    setError('');
    try {
      await refreshQuote(form.couponCode);
    } catch (e) {
      setQuote(null);
      setError(e instanceof Error ? e.message : 'Could not apply promo code');
    } finally {
      setPromoLoading(false);
    }
  }

  async function removePromoCode() {
    setForm((f) => ({ ...f, couponCode: '' }));
    setPromoLoading(true);
    setError('');
    try {
      await refreshQuote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh price');
    } finally {
      setPromoLoading(false);
    }
  }

  const selectedAddress = addresses.find((a) => a._id === form.addressId);
  const showScheduleSupport =
    step === 'schedule' &&
    Boolean(form.addressId) &&
    !availabilityLoading &&
    (Boolean(availabilityError) || !operatingHours);

  async function goNext() {
    setError('');
    if (step === 'service' && !form.bookingType) {
      setError('Select a service');
      return;
    }
    if (step === 'address') {
      if (!form.addressId) {
        setError('Select an address');
        return;
      }
      const selected = addresses.find((a) => a._id === form.addressId);
      if (!addressHasCoords(selected)) {
        setError('Selected address has no GPS pin. Update it in Profile with "Use current location".');
        return;
      }
    }
    if (step === 'shop' && !form.branchId && !form.autoDispatch) {
      setError(`Select a laundry shop or let ${brandName} pick one for you`);
      return;
    }
    if (step === 'schedule' && !form.scheduledPickupAt) {
      setError('Select a pickup time');
      return;
    }
    if (step === 'weight') {
      const garmentPriced = Boolean(form.bookingType && isGarmentPricedBookingType(form.bookingType));
      if (garmentPriced) {
        const hasSelection = Object.values(form.garmentQuantities).some((q) => Number(q) > 0);
        if (!hasSelection) {
          setError('Select at least one garment');
          return;
        }
      } else if (shopPricingMode === BranchPricingMode.FLAT_BAG && !form.bagSizeId) {
        setError('Choose a bag size');
        return;
      }
      if (!garmentPriced && shopPricingMode === BranchPricingMode.PER_KG && !Number(form.enteredWeightKg)) {
        setError('Enter the estimated weight');
        return;
      }
      if (
        (shopPricingMode === BranchPricingMode.PER_KG || shopPricingMode === BranchPricingMode.PER_LOAD) &&
        Number(form.enteredWeightKg) &&
        Number(form.enteredWeightKg) < BOOKING_PER_KG_MIN_KG
      ) {
        setError(`Minimum booking weight is ${BOOKING_PER_KG_MIN_KG} kg`);
        return;
      }
      if (
        shopPricingMode === BranchPricingMode.PER_KG &&
        Number(form.enteredWeightKg) > resolvePerKgMaxKg(shopKgPerLoad)
      ) {
        setError(`Per-kg pricing only covers up to ${resolvePerKgMaxKg(shopKgPerLoad)} kg`);
        return;
      }
      if (
        shopPricingMode === BranchPricingMode.PER_LOAD &&
        !Number(form.enteredWeightKg) &&
        !Number(form.enteredLoadCount)
      ) {
        setError('Enter the estimated weight or load count');
        return;
      }
      if (
        shopPricingMode === BranchPricingMode.PER_LOAD &&
        Number(form.enteredWeightKg) > BOOKING_MAX_WEIGHT_KG
      ) {
        setError(`Enter a realistic weight — up to ${BOOKING_MAX_WEIGHT_KG} kg per order`);
        return;
      }
      if (
        shopPricingMode === BranchPricingMode.PER_LOAD &&
        Number(form.enteredLoadCount) > estimateMachineLoads(BOOKING_MAX_WEIGHT_KG, shopKgPerLoad)
      ) {
        setError('Enter a realistic load count for this order');
        return;
      }
      if (
        !garmentPriced &&
        (shopPricingMode === BranchPricingMode.PER_PIECE ||
          shopPricingMode === BranchPricingMode.PER_PAIR ||
          shopPricingMode === BranchPricingMode.PER_ITEM) &&
        !Number(form.enteredPieceCount)
      ) {
        setError('Enter the count');
        return;
      }
    }
    if (step === 'review') {
      try {
        await refreshQuote();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not calculate price');
        return;
      }
    }
    const n = nextStep(step);
    if (n) setStep(n);
  }

  function goBack() {
    setError('');
    const p = prevStep(step);
    if (p) setStep(p);
    else router.back();
  }

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={goBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
      ),
    });
    // `goBack`/`navigation` intentionally excluded: `goBack` is redefined every render and
    // already closes over the current `step`, so re-running this effect only on `step` change
    // (not on every render) is correct and avoids redundant header resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function placeOrder() {
    if (
      !form.bookingType ||
      !form.addressId ||
      (!form.branchId && !form.autoDispatch) ||
      !form.scheduledPickupAt
    )
      return;
    if (placingOrderRef.current) return;
    placingOrderRef.current = true;
    setLoading(true);
    setError('');

    // Order creation and payment initiation are two separate API calls — if the order is
    // created but the payment step then fails, the order still exists as a real PENDING order
    // (not nothing), so retrying from scratch would create a *duplicate*. Route to the existing
    // standalone checkout screen (which already knows how to load/retry payment for an existing
    // order) instead of just showing a generic failure and leaving an orphaned order behind.
    let createdOrderId: string | null = null;
    try {
      const order = await apiFetch<{ _id: string; total: number }>('/booking/orders', {
        method: 'POST',
        body: JSON.stringify({
          services: [
            {
              bookingType: form.bookingType,
              ...(form.customServiceId ? { customServiceId: form.customServiceId } : {}),
              ...(form.bagSizeId ? { bagSizeId: form.bagSizeId } : {}),
              ...(Number(form.enteredWeightKg) ? { enteredWeightKg: Number(form.enteredWeightKg) } : {}),
              ...(Number(form.enteredLoadCount) ? { enteredLoadCount: Number(form.enteredLoadCount) } : {}),
              ...(Number(form.enteredPieceCount) ? { enteredPieceCount: Number(form.enteredPieceCount) } : {}),
              ...(buildGarmentSelectionsPayload(form) ? { garmentSelections: buildGarmentSelectionsPayload(form) } : {}),
            },
          ],
          ...(form.branchId ? { branchId: form.branchId } : {}),
          addonIds: form.addonIds,
          addonQuantities: form.addonQuantities,
          pickupAddressId: form.addressId,
          scheduledPickupAt: form.scheduledPickupAt,
          ...(form.couponCode.trim() ? { couponCode: form.couponCode.trim() } : {}),
        }),
      });
      createdOrderId = order._id;

      const payment = await apiFetch<{
        paid?: boolean;
        checkoutUrl?: string;
        payment?: { _id: string };
        receiptCode?: string;
        message?: string;
      }>('/payments/intent', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order._id,
          method: paymentMethod,
          clientOrigin: getCustomerClientOrigin(),
          ...(paymentMethod === PaymentMethod.CASH ? { cashTiming } : {}),
        }),
      });

      const goToOrder = () => router.replace(`/orders/${order._id}`);

      if (payment.paid) {
        Alert.alert(
          'Booked!',
          'Payment received. Your laundry shop has been notified.',
          [{ text: 'Track order', onPress: goToOrder }],
        );
        return;
      }

      if (paymentMethod === PaymentMethod.CASH) {
        Alert.alert(
          'Booking confirmed',
          payment.message ??
          (payment.receiptCode
            ? `Pay cash as arranged. Reference: ${payment.receiptCode}`
            : 'Pay cash as arranged. Your laundry shop has been notified.'),
          [{ text: 'Track order', onPress: goToOrder }],
        );
        return;
      }

      if (payment.checkoutUrl) {
        await Linking.openURL(payment.checkoutUrl);
        Alert.alert(
          'Complete payment',
          'Finish payment in your browser, then return here to track your order.',
          [{ text: 'Track order', onPress: goToOrder }],
        );
        return;
      }

      Alert.alert(
        'Order created',
        'We could not start payment automatically. Continue to checkout to complete payment for this order.',
        [{ text: 'Go to checkout', onPress: () => router.replace(`/checkout/${order._id}`) }],
      );
    } catch (e) {
      if (createdOrderId) {
        Alert.alert(
          'Order created',
          'Your order was created, but we could not start payment. Continue to checkout to complete payment.',
          [{ text: 'Go to checkout', onPress: () => router.replace(`/checkout/${createdOrderId}`) }],
        );
      } else {
        setError(e instanceof Error ? e.message : 'Booking failed');
      }
    } finally {
      placingOrderRef.current = false;
      setLoading(false);
    }
  }

  const activeQuote = quote ?? localQuote;
  const reviewBlocked = step === 'review' && activeQuote ? !activeQuote.meetsMinimum : false;
  const insufficientWallet =
    paymentMethod === PaymentMethod.WALLET &&
    walletBalance < (activeQuote?.total ?? 0);

  function payButtonLabel() {
    if (loading) return 'Processing…';
    if (paymentMethod === PaymentMethod.CASH) return 'Confirm & get receipt';
    if (paymentMethod === PaymentMethod.WALLET) return 'Pay with wallet';
    return 'Continue to PayMongo';
  }

  return (
    <View style={styles.container}>
      <BookingProgress current={step} />

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {configLoading && !config ? (
            <Text style={styles.sub}>Loading services…</Text>
          ) : null}

          {step === 'address' && (
            <View>
              <StepHeading step="address" title="Pickup address" />
              {addressesError ? <Text style={styles.error}>{addressesError}</Text> : null}
              {dispatchNote ? (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={styles.infoText}>{dispatchNote}</Text>
                </View>
              ) : null}
              {addresses.length === 0 ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.shopCard,
                    styles.autoDispatchCard,
                    pressed && styles.shopCardPressed,
                  ]}
                  onPress={() => router.push('/(tabs)/profile')}
                  accessibilityRole="button"
                  accessibilityLabel="Add address in Profile"
                >
                  <View style={styles.shopHeaderRow}>
                    <View style={styles.shopTitleGroup}>
                      <View style={styles.autoDispatchIcon}>
                        <Ionicons name="add" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.shopTitleTextGroup}>
                        <Text style={styles.shopName}>Add address in Profile</Text>
                        <Text style={styles.shopMetaText}>
                          Save a pickup address with GPS so riders can navigate to you
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                  </View>
                </Pressable>
              ) : (
                addresses.map((a) => {
                  const selected = form.addressId === a._id;
                  const hasCoords = addressHasCoords(a);
                  const addressIcon =
                    a.addressType === AddressType.WORK
                      ? 'briefcase-outline'
                      : a.addressType === AddressType.APARTMENT
                        ? 'business-outline'
                        : a.addressType === AddressType.OTHER
                          ? 'location-outline'
                          : 'home-outline';
                  return (
                  <Pressable
                    key={a._id}
                    style={({ pressed }) => [
                      styles.shopCard,
                      selected && styles.shopCardSelected,
                      !hasCoords && styles.shopCardDisabled,
                      pressed && styles.shopCardPressed,
                    ]}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        addressId: a._id,
                        branchId: '',
                        autoDispatch: false,
                        scheduledPickupAt: '',
                      }))
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.shopHeaderRow}>
                      <View style={styles.shopTitleGroup}>
                        <View style={styles.shopLogoFallback}>
                          <Ionicons name={addressIcon} size={20} color={colors.primary} />
                        </View>
                        <View style={styles.shopTitleTextGroup}>
                          <View style={styles.addressLabelRow}>
                            <Text style={styles.shopName} numberOfLines={1}>
                              {a.label}
                            </Text>
                            {a.isDefault ? (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>Default</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.shopMetaText} numberOfLines={2}>
                            {formatAddressTypeLabel(a.addressType)} · {a.line1}, {a.city}
                          </Text>
                        </View>
                      </View>
                      {selected ? (
                        <View style={styles.shopCheckBadge}>
                          <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                        </View>
                      ) : null}
                    </View>
                    {hasCoords ? (
                      <View style={[styles.statusPill, styles.statusPillOpen]}>
                        <Ionicons name="navigate" size={12} color={colors.accentDark} />
                        <Text style={[styles.statusPillText, styles.statusPillTextOpen]}>
                          GPS pinned for rider navigation
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.warnPill}>
                        <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                        <Text style={styles.warnPillText}>
                          No GPS pin — update in Profile before booking
                        </Text>
                      </View>
                    )}
                  </Pressable>
                  );
                })
              )}
            </View>
          )}

          {step === 'shop' && (
            <View>
              <StepHeading step="shop" title="Choose a laundry shop" />
              {reorderNotice ? <Text style={styles.optionGpsMissing}>{reorderNotice}</Text> : null}
              {!shopsLoading && shopOptions.length > 0 && !getPartnerId() ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.shopCard,
                    styles.autoDispatchCard,
                    form.autoDispatch && styles.shopCardSelected,
                    pressed && styles.shopCardPressed,
                  ]}
                  onPress={() => {
                    setReorderNotice('');
                    setForm((f) => ({ ...f, autoDispatch: true, branchId: '' }));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: form.autoDispatch }}
                >
                  <View style={styles.shopHeaderRow}>
                    <View style={styles.shopTitleGroup}>
                      <View style={styles.autoDispatchIcon}>
                        <Ionicons name="flash" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.shopTitleTextGroup}>
                        <Text style={styles.shopName}>Let {brandName} pick for you</Text>
                        <Text style={styles.shopMetaText}>
                          Best available shop nearby — handy when your usual spot is full.
                        </Text>
                      </View>
                    </View>
                    {form.autoDispatch ? (
                      <View style={styles.shopCheckBadge}>
                        <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ) : null}
              {shopsLoading ? (
                <Text style={styles.sub}>Finding nearby shops…</Text>
              ) : shopOptions.length === 0 ? (
                <Text style={styles.sub}>No partner shops are available near this address yet.</Text>
              ) : (
                (() => {
                  const flatBagFrom = config?.bagSizes?.length
                    ? Math.min(...config.bagSizes.map((b) => b.price))
                    : undefined;

                  // Partner build: keep the existing "nearest branch headlines, others behind a
                  // picker sheet" layout, still gated on withinRadius/capacity.
                  if (getPartnerId()) {
                    return shopOptions.map((shop) => {
                      const selected =
                        !form.autoDispatch &&
                        (form.branchId === shop.branchId ||
                          shop.branches.some((b) => b.branchId === form.branchId));
                      const startingPriceLabel = startingPriceLabelFor(shop, flatBagFrom);
                      const hasMultipleBranches = shop.branches.length > 1;
                      // Once the customer has picked a specific branch from the sheet, the card
                      // should reflect that branch (name/city/hours), not always the nearest one.
                      const activeBranch: ShopOption | ShopBranchVariant =
                        selected && form.branchId !== shop.branchId
                          ? (shop.branches.find((b) => b.branchId === form.branchId) ?? shop)
                          : shop;
                      const schedule = getTodayScheduleSummary(
                        activeBranch.operatingHours,
                        activeBranch.holidays,
                      );
                      const disabled =
                        !shop.withinRadius || !shop.withinMaxDeliveryRadius || !shop.capacityAvailable;
                      return (
                        <Pressable
                          key={shop.branchId}
                          disabled={disabled}
                          style={({ pressed }) => [
                            styles.shopCard,
                            selected && styles.shopCardSelected,
                            disabled && styles.shopCardDisabled,
                            pressed && !disabled && styles.shopCardPressed,
                          ]}
                          onPress={() => {
                            setReorderNotice('');
                            if (hasMultipleBranches) {
                              setBranchSheetShopId(shop.branchId);
                              return;
                            }
                            setForm((f) => ({ ...f, branchId: shop.branchId, autoDispatch: false }));
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected, disabled }}
                        >
                          <View style={styles.shopHeaderRow}>
                            <View style={styles.shopTitleGroup}>
                              {shop.logoUrl ? (
                                <Image
                                  source={{ uri: resolveMediaUrl(shop.logoUrl) }}
                                  style={styles.shopLogo}
                                />
                              ) : (
                                <View style={styles.shopLogoFallback}>
                                  <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                                </View>
                              )}
                              <View style={styles.shopTitleTextGroup}>
                                <Text style={styles.shopName} numberOfLines={1}>
                                  {activeBranch.name}
                                </Text>
                                <View style={styles.shopMetaRow}>
                                  <Ionicons name="location-outline" size={12} color={colors.muted} />
                                  <Text style={styles.shopMetaText}>
                                    {activeBranch.city} · {activeBranch.distanceLabel}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={styles.shopActionsGroup}>
                              <Pressable
                                onPress={() => toggleFavoriteBranch(shop.branchId)}
                                hitSlop={8}
                                style={styles.shopFavBtn}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  favoriteBranchIds.has(shop.branchId)
                                    ? `Remove ${shop.name} from favorites`
                                    : `Add ${shop.name} to favorites`
                                }
                              >
                                <Ionicons
                                  name={favoriteBranchIds.has(shop.branchId) ? 'heart' : 'heart-outline'}
                                  size={16}
                                  color={favoriteBranchIds.has(shop.branchId) ? colors.destructive : colors.mutedForeground}
                                />
                              </Pressable>
                              {selected ? (
                                <View style={styles.shopCheckBadge}>
                                  <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.shopStatusRow}>
                            <View
                              style={[
                                styles.statusPill,
                                schedule.isOpenNow ? styles.statusPillOpen : styles.statusPillClosed,
                              ]}
                            >
                              <View
                                style={[
                                  styles.statusDot,
                                  schedule.isOpenNow ? styles.statusDotOpen : styles.statusDotClosed,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.statusPillText,
                                  schedule.isOpenNow
                                    ? styles.statusPillTextOpen
                                    : styles.statusPillTextClosed,
                                ]}
                              >
                                {schedule.label}
                              </Text>
                            </View>
                            {startingPriceLabel ? (
                              <Text style={styles.shopPriceTag}>{startingPriceLabel}</Text>
                            ) : null}
                          </View>

                          {hasMultipleBranches ? (
                            <View style={styles.branchChip}>
                              <Ionicons name="git-branch-outline" size={13} color={colors.primary} />
                              <Text style={styles.branchChipText}>
                                {selected
                                  ? `${shop.branches.length} branches near you — tap to change`
                                  : `${shop.branches.length} branches near you — tap to choose`}
                              </Text>
                              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                            </View>
                          ) : null}

                          {!shop.capacityAvailable ? (
                            <View style={styles.warnPill}>
                              <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                              <Text style={styles.warnPillText}>Currently at capacity</Text>
                            </View>
                          ) : null}
                          {!shop.withinRadius || !shop.withinMaxDeliveryRadius ? (
                            <View style={styles.warnPill}>
                              <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                              <Text style={styles.warnPillText}>Outside delivery range</Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    });
                  }

                  // Default (non-partner) build: every branch of every partner is its own row,
                  // nearest-first. Distance no longer blocks selection — a far branch is just
                  // visually de-emphasized (blur) while in-range branches are highlighted, so
                  // customers can still deliberately pick a farther shop if they want to.
                  // Capacity is a hard constraint (the shop truly can't take the order), so it
                  // still disables the row.
                  const allBranches = shopOptions
                    .flatMap((shop) => shop.branches)
                    .sort((a, b) => a.distanceKm - b.distanceKm);

                  return allBranches.map((branch) => {
                    const selected = !form.autoDispatch && form.branchId === branch.branchId;
                    const startingPriceLabel = startingPriceLabelFor(branch, flatBagFrom);
                    const schedule = getTodayScheduleSummary(branch.operatingHours, branch.holidays);
                    // Beyond the platform's hard delivery ceiling, checkout always rejects the
                    // order — that must block selection outright, not just look dimmer, or the
                    // customer walks through the whole flow only to hit a wall at quote time.
                    const disabled = !branch.capacityAvailable || !branch.withinMaxDeliveryRadius;
                    const far = !branch.withinRadius && branch.withinMaxDeliveryRadius;
                    return (
                      <Pressable
                        key={branch.branchId}
                        disabled={disabled}
                        style={({ pressed }) => [
                          styles.shopCard,
                          selected && styles.shopCardSelected,
                          far && styles.shopCardFar,
                          disabled && styles.shopCardDisabled,
                          pressed && !disabled && styles.shopCardPressed,
                        ]}
                        onPress={() => {
                          setReorderNotice('');
                          setForm((f) => ({ ...f, branchId: branch.branchId, autoDispatch: false }));
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled }}
                      >
                        <View style={styles.shopHeaderRow}>
                          <View style={styles.shopTitleGroup}>
                            {branch.logoUrl ? (
                              <Image
                                source={{ uri: resolveMediaUrl(branch.logoUrl) }}
                                style={styles.shopLogo}
                              />
                            ) : (
                              <View style={styles.shopLogoFallback}>
                                <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                              </View>
                            )}
                            <View style={styles.shopTitleTextGroup}>
                              <Text style={styles.shopName} numberOfLines={1}>
                                {branch.name}
                              </Text>
                              <View style={styles.shopMetaRow}>
                                <Ionicons name="location-outline" size={12} color={colors.muted} />
                                <Text style={styles.shopMetaText}>
                                  {branch.city} · {branch.distanceLabel}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={styles.shopActionsGroup}>
                            <Pressable
                              onPress={() => toggleFavoriteBranch(branch.branchId)}
                              hitSlop={8}
                              style={styles.shopFavBtn}
                              accessibilityRole="button"
                              accessibilityLabel={
                                favoriteBranchIds.has(branch.branchId)
                                  ? `Remove ${branch.name} from favorites`
                                  : `Add ${branch.name} to favorites`
                              }
                            >
                              <Ionicons
                                name={favoriteBranchIds.has(branch.branchId) ? 'heart' : 'heart-outline'}
                                size={16}
                                color={favoriteBranchIds.has(branch.branchId) ? colors.destructive : colors.mutedForeground}
                              />
                            </Pressable>
                            {selected ? (
                              <View style={styles.shopCheckBadge}>
                                <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <View style={styles.shopStatusRow}>
                          <View
                            style={[
                              styles.statusPill,
                              schedule.isOpenNow ? styles.statusPillOpen : styles.statusPillClosed,
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                schedule.isOpenNow ? styles.statusDotOpen : styles.statusDotClosed,
                              ]}
                            />
                            <Text
                              style={[
                                styles.statusPillText,
                                schedule.isOpenNow ? styles.statusPillTextOpen : styles.statusPillTextClosed,
                              ]}
                            >
                              {schedule.label}
                            </Text>
                          </View>
                          {startingPriceLabel ? (
                            <Text style={styles.shopPriceTag}>{startingPriceLabel}</Text>
                          ) : null}
                        </View>

                        {!branch.capacityAvailable ? (
                          <View style={styles.warnPill}>
                            <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                            <Text style={styles.warnPillText}>Currently at capacity</Text>
                          </View>
                        ) : null}
                        {!branch.withinMaxDeliveryRadius ? (
                          <View style={styles.warnPill}>
                            <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                            <Text style={styles.warnPillText}>Outside delivery range</Text>
                          </View>
                        ) : far ? (
                          <View style={styles.warnPill}>
                            <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                            <Text style={styles.warnPillText}>
                              Farther than usual — may need extra approval
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  });
                })()
              )}
            </View>
          )}

          {step === 'service' && config && (
            <View>
              <StepHeading step="service" title="Choose service" />
              <View style={styles.shopContextCard}>
                {form.autoDispatch ? (
                  <View style={styles.autoDispatchIcon}>
                    <Ionicons name="flash" size={18} color={colors.primary} />
                  </View>
                ) : selectedShop?.logoUrl ? (
                  <Image
                    source={{ uri: resolveMediaUrl(selectedShop.logoUrl) }}
                    style={styles.shopLogo}
                  />
                ) : (
                  <View style={styles.shopLogoFallback}>
                    <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                  </View>
                )}
                <View style={styles.summaryShopTextGroup}>
                  <Text style={styles.summaryMuted}>Booking with</Text>
                  <Text style={styles.summaryShopName}>
                    {form.autoDispatch
                      ? `${brandName}'s pick (best available)`
                      : (selectedBranch?.name ?? 'Selected shop')}
                  </Text>
                </View>
              </View>
              {services.map((s) => {
                const selected = s.isCustom
                  ? form.customServiceId === s.customServiceId
                  : form.bookingType === s.type && !form.customServiceId;
                return (
                  <Pressable
                    key={s.customServiceId ?? s.type}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        bookingType: s.type as BookingType,
                        customServiceId: s.customServiceId ?? '',
                      }))
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.optionTopRow}>
                      <Text style={styles.optionTitle}>
                        {s.label}
                        {s.isCustom ? (
                          <Text style={styles.optionBadge}> · Shop special</Text>
                        ) : null}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : null}
                    </View>
                    <Text style={styles.optionSub}>{s.description}</Text>
                    <Text style={styles.optionPrice}>
                      {s.pricingUnit === BranchPricingMode.PER_LOAD && s.basePricePerLoad != null
                        ? `${formatCurrency(s.basePricePerLoad)} / load`
                        : s.pricingUnit === BranchPricingMode.PER_PIECE && s.basePricePerPiece != null
                          ? `${formatCurrency(s.basePricePerPiece)} / piece`
                          : s.pricingUnit === BranchPricingMode.PER_PAIR && s.basePricePerPair != null
                            ? `${formatCurrency(s.basePricePerPair)} / pair`
                            : s.pricingUnit === BranchPricingMode.PER_ITEM && s.basePricePerItem != null
                              ? `${formatCurrency(s.basePricePerItem)} / item`
                              : s.pricingUnit === BranchPricingMode.FIXED && s.fixedPrice != null
                                ? `${formatCurrency(s.fixedPrice)} fixed price`
                                : s.pricingUnit === BranchPricingMode.FLAT_BAG
                                  ? 'Priced by bag size'
                                  : `${formatCurrency(s.pricePerKg)} / kg · min ${s.minWeightKg} kg`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {step === 'schedule' && (
            <View>
              <StepHeading step="schedule" title="Pickup time" />
              {availabilityError ? (
                <View style={styles.errorBlock}>
                  <Text style={styles.error}>{availabilityError}</Text>
                  {form.addressId ? (
                    <Button
                      label="Try again"
                      variant="secondary"
                      onPress={() => loadAvailability(form.addressId)}
                      style={styles.retryBtn}
                    />
                  ) : null}
                </View>
              ) : null}
              {areaLabel ? <Text style={styles.sub}>Serving: {areaLabel}</Text> : null}
              {!operatingHours && !availabilityError ? (
                <Text style={styles.sub}>No pickup schedule available for this address.</Text>
              ) : null}
              {operatingHours ? (
                <PickupSchedulePicker
                  operatingHours={operatingHours}
                  holidays={holidays}
                  serverNow={serverNow}
                  selectedStartAt={form.scheduledPickupAt}
                  onSelectStartAt={(startAt) => setForm((f) => ({ ...f, scheduledPickupAt: startAt }))}
                />
              ) : null}
              {showScheduleSupport ? (
                <ScheduleSupportPrompt
                  address={selectedAddress}
                  reason={availabilityError || 'No pickup schedule is available for this address yet.'}
                />
              ) : null}
            </View>
          )}

          {step === 'weight' && form.bookingType && isGarmentPricedBookingType(form.bookingType) && (
            <View>
              <StepHeading step="weight" title="Select your garments" />
              <Text style={styles.sub}>
                Pick each garment you&apos;re sending in and how many — priced per garment, no estimate needed.
              </Text>
              {getGarmentCategories(selectedShop?.garmentCatalog ?? GARMENT_CATALOG).map((category) => (
                <View key={category} style={styles.garmentCategoryCard}>
                  <Text style={styles.optionTitle}>{category}</Text>
                  {(selectedShop?.garmentCatalog ?? GARMENT_CATALOG)
                    .filter((g) => g.category === category)
                    .map((garment, i) => {
                    const qty = Number(form.garmentQuantities[garment.id]) || 0;
                    return (
                      <View
                        key={garment.id}
                        style={[styles.garmentRow, i === 0 && styles.garmentRowFirst]}
                      >
                        <View>
                          <Text style={styles.optionSub}>{garment.label}</Text>
                          <Text style={styles.optionSub}>{formatCurrency(garment.price)} each</Text>
                        </View>
                        <View style={styles.garmentQtyRow}>
                          <Pressable
                            style={styles.garmentQtyBtn}
                            disabled={qty <= 0}
                            onPress={() =>
                              setForm((f) => ({
                                ...f,
                                garmentQuantities: {
                                  ...f.garmentQuantities,
                                  [garment.id]: String(Math.max(0, qty - 1)),
                                },
                              }))
                            }
                          >
                            <Ionicons name="remove" size={16} color={colors.foreground} />
                          </Pressable>
                          <Text style={styles.garmentQtyValue}>{qty}</Text>
                          <Pressable
                            style={styles.garmentQtyBtn}
                            onPress={() =>
                              setForm((f) => ({
                                ...f,
                                garmentQuantities: {
                                  ...f.garmentQuantities,
                                  [garment.id]: String(qty + 1),
                                },
                              }))
                            }
                          >
                            <Ionicons name="add" size={16} color={colors.foreground} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
              {localQuote ? (
                <Text style={styles.optionPrice}>
                  Subtotal: {formatCurrency(localQuote.serviceSubtotal)}
                </Text>
              ) : null}
            </View>
          )}

          {step === 'weight' &&
            !(form.bookingType && isGarmentPricedBookingType(form.bookingType)) &&
            shopPricingMode === BranchPricingMode.FLAT_BAG && (
            <View>
              <StepHeading step="weight" title="Choose a bag size" />
              <Text style={styles.sub}>
                Same flat price everywhere. We&apos;ll confirm actual weight at pickup. Min order{' '}
                {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
              </Text>
              {(config?.bagSizes ?? []).map((bag) => {
                const selected = form.bagSizeId === bag.id;
                return (
                  <Pressable
                    key={bag.id}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() => setForm((f) => ({ ...f, bagSizeId: bag.id }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.optionTopRow}>
                      <Text style={styles.optionTitle}>{bag.label}</Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : null}
                    </View>
                    <Text style={styles.optionSub}>
                      Up to {bag.capacityKg} kg · {formatMachineLoadLabel(bag.capacityKg)}
                    </Text>
                    <Text style={styles.optionPrice}>{formatCurrency(bag.price)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {step === 'weight' &&
            !(form.bookingType && isGarmentPricedBookingType(form.bookingType)) &&
            shopPricingMode === BranchPricingMode.PER_KG && (
            <View>
              <StepHeading step="weight" title="Estimate your weight" />
              {(() => {
                const perKgMaxKg = resolvePerKgMaxKg(shopKgPerLoad);
                const bag = recommendBagForWeight(Number(form.enteredWeightKg) || 0, config?.bagSizes ?? []);
                const belowMin =
                  Number(form.enteredWeightKg) > 0 && Number(form.enteredWeightKg) < BOOKING_PER_KG_MIN_KG;
                const aboveMax = Number(form.enteredWeightKg) > perKgMaxKg;
                return (
                  <View style={styles.weightCard}>
                    <View style={styles.weightIconRow}>
                      <View style={styles.autoDispatchIcon}>
                        <Ionicons name="scale-outline" size={20} color={colors.primary} />
                      </View>
                      <Text style={styles.weightCardDesc}>
                        Charged per kilo, for loads up to {perKgMaxKg} kg (minimum {BOOKING_PER_KG_MIN_KG} kg).
                        Heavier loads are billed per machine load instead —{' '}
                        {machineLoadInfo(shopKgPerLoad)}
                      </Text>
                    </View>
                    <View style={styles.weightReadoutRow}>
                      <Text style={styles.weightReadoutValue}>
                        {form.enteredWeightKg ? Number(form.enteredWeightKg) : '—'}
                      </Text>
                      <Text style={styles.weightReadoutUnit}>kg</Text>
                    </View>
                    <WeightSlider
                      value={form.enteredWeightKg}
                      maxKg={perKgMaxKg}
                      onChange={(v) => setForm((f) => ({ ...f, enteredWeightKg: v }))}
                    />
                    {bag ? (
                      <View style={styles.weightHintPill}>
                        <Ionicons name="bag-outline" size={13} color={colors.muted} />
                        <Text style={styles.weightHintPillText}>
                          Roughly a {bag.label} bag (up to {bag.capacityKg} kg)
                        </Text>
                      </View>
                    ) : null}
                    {belowMin ? (
                      <View style={styles.warnPill}>
                        <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                        <Text style={styles.warnPillText}>
                          Minimum booking weight is {BOOKING_PER_KG_MIN_KG} kg
                        </Text>
                      </View>
                    ) : null}
                    {aboveMax ? (
                      <View style={styles.warnPill}>
                        <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                        <Text style={styles.warnPillText}>
                          Above {perKgMaxKg} kg counts as{' '}
                          {formatMachineLoadLabel(Number(form.enteredWeightKg), shopKgPerLoad)} instead of
                          per-kg pricing
                        </Text>
                      </View>
                    ) : null}
                    {localQuote ? (
                      <Text style={styles.weightPriceTag}>
                        Estimated: {formatCurrency(localQuote.serviceSubtotal)}
                      </Text>
                    ) : null}
                  </View>
                );
              })()}
            </View>
          )}

          {step === 'weight' &&
            !(form.bookingType && isGarmentPricedBookingType(form.bookingType)) &&
            shopPricingMode === BranchPricingMode.PER_LOAD && (
            <View>
              <StepHeading step="weight" title="Estimate your load count" />
              {(() => {
                const bag = recommendBagForWeight(Number(form.enteredWeightKg) || 0, config?.bagSizes ?? []);
                const belowMin =
                  Number(form.enteredWeightKg) > 0 && Number(form.enteredWeightKg) < BOOKING_PER_KG_MIN_KG;
                const aboveMax = Number(form.enteredWeightKg) > BOOKING_MAX_WEIGHT_KG;
                return (
                  <View style={styles.weightCard}>
                    <View style={styles.weightIconRow}>
                      <View style={styles.autoDispatchIcon}>
                        <Ionicons name="layers-outline" size={20} color={colors.primary} />
                      </View>
                      <Text style={styles.weightCardDesc}>
                        Charged per machine load — minimum 1 load, up to {shopKgPerLoad} kg. Enter your
                        estimated weight (or load count directly); we&apos;ll confirm the actual load count
                        and final price at pickup. {machineLoadInfo(shopKgPerLoad)}
                      </Text>
                    </View>
                    <View style={styles.weightReadoutRow}>
                      <Text style={styles.weightReadoutValue}>
                        {form.enteredWeightKg ? Number(form.enteredWeightKg) : '—'}
                      </Text>
                      <Text style={styles.weightReadoutUnit}>kg</Text>
                    </View>
                    <WeightSlider
                      value={form.enteredWeightKg}
                      maxKg={BOOKING_MAX_WEIGHT_KG}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          enteredWeightKg: v,
                          enteredLoadCount: v ? String(estimateMachineLoads(Number(v) || 0, shopKgPerLoad)) : '',
                        }))
                      }
                    />
                    {form.enteredLoadCount ? (
                      <View style={[styles.statusPill, styles.statusPillOpen]}>
                        <Ionicons name="layers" size={12} color={colors.accentDark} />
                        <Text style={[styles.statusPillText, styles.statusPillTextOpen]}>
                          {form.enteredLoadCount} machine load
                          {Number(form.enteredLoadCount) === 1 ? '' : 's'}
                        </Text>
                      </View>
                    ) : null}
                    {bag ? (
                      <View style={styles.weightHintPill}>
                        <Ionicons name="bag-outline" size={13} color={colors.muted} />
                        <Text style={styles.weightHintPillText}>
                          Roughly a {bag.label} bag (up to {bag.capacityKg} kg)
                        </Text>
                      </View>
                    ) : null}
                    {belowMin ? (
                      <View style={styles.warnPill}>
                        <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                        <Text style={styles.warnPillText}>
                          Minimum booking weight is {BOOKING_PER_KG_MIN_KG} kg
                        </Text>
                      </View>
                    ) : null}
                    {aboveMax ? (
                      <View style={styles.warnPill}>
                        <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                        <Text style={styles.warnPillText}>
                          Enter a realistic weight — up to {BOOKING_MAX_WEIGHT_KG} kg per order
                        </Text>
                      </View>
                    ) : null}
                    {localQuote ? (
                      <Text style={styles.weightPriceTag}>
                        Estimated: {formatCurrency(localQuote.serviceSubtotal)}
                      </Text>
                    ) : null}
                  </View>
                );
              })()}
            </View>
          )}

          {step === 'weight' &&
            !(form.bookingType && isGarmentPricedBookingType(form.bookingType)) &&
            (shopPricingMode === BranchPricingMode.PER_PIECE ||
              shopPricingMode === BranchPricingMode.PER_PAIR ||
              shopPricingMode === BranchPricingMode.PER_ITEM) &&
            (() => {
              const unitNoun =
                shopPricingMode === BranchPricingMode.PER_PAIR
                  ? 'pair'
                  : shopPricingMode === BranchPricingMode.PER_ITEM
                    ? 'item'
                    : 'piece';
              const perUnitItems = addons.filter((a) => a.pricingUnit === shopPricingMode);
              return (
                <View>
                  <StepHeading step="weight" title={`Estimate your ${unitNoun} count`} />
                  <View style={styles.weightCard}>
                    <View style={styles.weightIconRow}>
                      <View style={styles.autoDispatchIcon}>
                        <Ionicons name="shirt-outline" size={20} color={colors.primary} />
                      </View>
                      <Text style={styles.weightCardDesc}>
                        Charged per {unitNoun}. Enter an estimated {unitNoun} count now — we&apos;ll
                        confirm the actual count and final price at pickup. Min order{' '}
                        {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
                      </Text>
                    </View>
                    <View style={styles.weightInputRow}>
                      <TextInput
                        style={styles.weightInputLarge}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                        value={form.enteredPieceCount}
                        onChangeText={(v) => setForm((f) => ({ ...f, enteredPieceCount: v }))}
                      />
                      <View style={styles.weightUnitChip}>
                        <Text style={styles.weightUnitChipText}>{unitNoun}s</Text>
                      </View>
                    </View>
                    {localQuote ? (
                      <Text style={styles.weightPriceTag}>
                        Estimated: {formatCurrency(localQuote.serviceSubtotal)}
                      </Text>
                    ) : null}
                  </View>
                  {perUnitItems.length > 0 ? (
                    <View style={styles.weightCard}>
                      <Text style={styles.optionTitle}>Items priced per {unitNoun}</Text>
                      {perUnitItems.map((item) => (
                        <View key={item.id} style={styles.addonRow}>
                          <Text style={styles.optionSub}>{item.label}</Text>
                          <Text style={styles.optionSub}>
                            {formatCurrency(item.price)} / {unitNoun}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })()}

          {step === 'weight' &&
            !(form.bookingType && isGarmentPricedBookingType(form.bookingType)) &&
            shopPricingMode === BranchPricingMode.FIXED && (
            <View>
              <StepHeading step="weight" title="Fixed price service" />
              <Text style={styles.sub}>
                This shop charges one flat price for this service, regardless of quantity.
              </Text>
              {localQuote ? (
                <Text style={styles.optionPrice}>Price: {formatCurrency(localQuote.serviceSubtotal)}</Text>
              ) : null}
            </View>
          )}

          {step === 'addons' && (
            <View>
              <StepHeading step="addons" title="Add-ons (optional)" />
              {addons.length === 0 ? (
                <Text style={styles.sub}>No add-ons available.</Text>
              ) : (
                addons.map((a) => {
                  const selected = form.addonIds.includes(a.id);
                  const isExpressReturn = a.id === EXPRESS_RETURN_ADDON_ID;
                  const disabled = isExpressReturn && !expressReturnAllowed;
                  const unitSuffix =
                    a.pricingUnit === BranchPricingMode.PER_KG
                      ? ' / kg'
                      : a.pricingUnit === BranchPricingMode.PER_LOAD
                        ? ' / load'
                        : a.pricingUnit === BranchPricingMode.PER_PIECE
                          ? ' / piece'
                          : a.pricingUnit === BranchPricingMode.PER_PAIR
                            ? ' / pair'
                            : a.pricingUnit === BranchPricingMode.PER_ITEM
                              ? ' / item'
                              : '';
                  const quantity = form.addonQuantities[a.id] ?? 1;
                  const maxQuantity = a.maxQuantity ?? 5;

                  const cardBody = (
                    <View style={styles.addonCardRow}>
                      <View style={styles.addonImagePlaceholder}>
                        <Ionicons
                          name={ADDON_ICONS[a.id] ?? ADDON_ICON_FALLBACK}
                          size={22}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.addonCardBody}>
                        <View style={styles.addonRow}>
                          <Text style={styles.optionTitle}>{a.label}</Text>
                          <View style={styles.addonRight}>
                            <Text style={styles.addonPrice}>
                              {a.isPercentOfService ? `+${a.price}%` : `+${formatCurrency(a.price)}${unitSuffix}`}
                            </Text>
                            {selected && !a.allowsQuantity ? (
                              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                            ) : null}
                          </View>
                        </View>
                        <Text style={styles.optionSub}>{a.description}</Text>
                        {!a.isPercentOfService && (
                          <Text style={styles.addonIncludedBadge}>Included with your service</Text>
                        )}
                        {disabled ? (
                          <Text style={styles.optionGpsMissing}>
                            Not available for pickups at 3:00 PM or later
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );

                  if (a.allowsQuantity && selected) {
                    return (
                      <View key={a.id} style={[styles.option, styles.optionSelected]}>
                        {cardBody}
                        <View style={[styles.garmentQtyRow, { justifyContent: 'flex-end', marginTop: spacing.sm }]}>
                          <Pressable
                            style={styles.garmentQtyBtn}
                            onPress={() =>
                              setForm((f) => {
                                const next = quantity - 1;
                                if (next <= 0) {
                                  return { ...f, addonIds: f.addonIds.filter((id) => id !== a.id) };
                                }
                                return { ...f, addonQuantities: { ...f.addonQuantities, [a.id]: next } };
                              })
                            }
                          >
                            <Ionicons name="remove" size={16} color={colors.foreground} />
                          </Pressable>
                          <Text style={styles.garmentQtyValue}>{quantity}</Text>
                          <Pressable
                            style={styles.garmentQtyBtn}
                            disabled={quantity >= maxQuantity}
                            onPress={() =>
                              setForm((f) => ({
                                ...f,
                                addonQuantities: {
                                  ...f.addonQuantities,
                                  [a.id]: Math.min(quantity + 1, maxQuantity),
                                },
                              }))
                            }
                          >
                            <Ionicons name="add" size={16} color={colors.foreground} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={a.id}
                      disabled={disabled}
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionSelected,
                        disabled && styles.optionDisabled,
                        pressed && !disabled && styles.optionPressed,
                      ]}
                      onPress={() =>
                        setForm((f) => ({
                          ...f,
                          addonIds: selected
                            ? f.addonIds.filter((id) => id !== a.id)
                            : [...f.addonIds, a.id],
                          addonQuantities:
                            a.allowsQuantity && !selected
                              ? { ...f.addonQuantities, [a.id]: 1 }
                              : f.addonQuantities,
                        }))
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled }}
                    >
                      {cardBody}
                    </Pressable>
                  );
                })
              )}
              {shopPricingMode !== BranchPricingMode.PER_PIECE &&
              shopPricingMode !== BranchPricingMode.PER_PAIR &&
              shopPricingMode !== BranchPricingMode.PER_ITEM &&
              form.addonIds.some((id) => {
                const unit = addons.find((a) => a.id === id)?.pricingUnit;
                return (
                  unit === BranchPricingMode.PER_PIECE ||
                  unit === BranchPricingMode.PER_PAIR ||
                  unit === BranchPricingMode.PER_ITEM
                );
              }) ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.optionSub}>Piece count (for the per-piece add-on above)</Text>
                  <TextInput
                    style={styles.weightInput}
                    keyboardType="number-pad"
                    placeholder="e.g. 4"
                    value={form.enteredPieceCount}
                    onChangeText={(v) => setForm((f) => ({ ...f, enteredPieceCount: v }))}
                  />
                </View>
              ) : null}
            </View>
          )}

          {step === 'review' && activeQuote && (
            <View>
              <StepHeading step="review" title="Price estimate" />
              <View style={styles.promoCard}>
                <Text style={styles.promoTitle}>Promo code</Text>
                {activeQuote.couponCode ? (
                  <View style={styles.promoAppliedRow}>
                    <View style={styles.promoAppliedText}>
                      <Text style={styles.promoAppliedCode}>{activeQuote.couponCode}</Text>
                      {activeQuote.promotionTitle ? (
                        <Text style={styles.promoAppliedSub}>{activeQuote.promotionTitle}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => void removePromoCode()}
                      disabled={promoLoading}
                      style={({ pressed }) => pressed && styles.linkPressed}
                      accessibilityRole="button"
                      accessibilityLabel="Remove promo code"
                      hitSlop={6}
                    >
                      <Text style={styles.promoRemove}>Remove</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.promoInputRow}>
                    <TextInput
                      value={form.couponCode}
                      onChangeText={(text) => setForm((f) => ({ ...f, couponCode: text.toUpperCase() }))}
                      placeholder="e.g. WELCOME10"
                      autoCapitalize="characters"
                      style={styles.promoInput}
                    />
                    <Pressable
                      style={[styles.promoApplyBtn, (!form.couponCode.trim() || promoLoading) && styles.btnDisabled]}
                      onPress={() => void applyPromoCode()}
                      disabled={!form.couponCode.trim() || promoLoading}
                    >
                      <Text style={styles.promoApplyText}>Apply</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <View style={styles.estimateCard}>
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>
                    {activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
                      ? `${activeQuote.serviceLabel} — ${activeQuote.bagLabel} bag`
                      : activeQuote.serviceLabel}
                  </Text>
                  <Text>{formatCurrency(activeQuote.serviceSubtotal)}</Text>
                </View>
                {activeQuote.addons.map((a) => {
                  const detail = a.percent
                    ? `${a.label} (+${a.percent}%)`
                    : a.unit === BranchPricingMode.PER_KG
                      ? `${a.label} (${a.quantity ?? 0} kg)`
                      : a.unit === BranchPricingMode.PER_LOAD
                        ? `${a.label} (×${a.quantity ?? 0} load${a.quantity === 1 ? '' : 's'})`
                        : a.unit === BranchPricingMode.PER_PIECE
                          ? `${a.label} (×${a.quantity ?? 0} piece${a.quantity === 1 ? '' : 's'})`
                          : a.unit === BranchPricingMode.PER_PAIR
                            ? `${a.label} (×${a.quantity ?? 0} pair${a.quantity === 1 ? '' : 's'})`
                            : a.unit === BranchPricingMode.PER_ITEM
                              ? `${a.label} (×${a.quantity ?? 0} item${a.quantity === 1 ? '' : 's'})`
                              : a.label;
                  return (
                    <View key={a.id} style={styles.estimateRow}>
                      <Text style={styles.estimateLabelMuted}>{detail}</Text>
                      <Text style={styles.estimateLabelMuted}>{formatCurrency(a.price)}</Text>
                    </View>
                  );
                })}
                <View style={[styles.estimateRow, styles.estimateDivider]}>
                  <Text style={styles.estimateLabel}>Delivery fee</Text>
                  <Text>{formatCurrency(activeQuote.deliveryFee)}</Text>
                </View>
                {activeQuote.discount > 0 && (
                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>
                      Discount{activeQuote.promotionTitle ? ` — ${activeQuote.promotionTitle}` : ''}
                    </Text>
                    <Text>−{formatCurrency(activeQuote.discount)}</Text>
                  </View>
                )}
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateTotalLabel}>Estimated total</Text>
                  <Text style={styles.estimateTotal}>{formatCurrency(activeQuote.total)}</Text>
                </View>
              </View>
              {!activeQuote.meetsMinimum && (
                <Text style={styles.error}>
                  Below minimum order of {formatCurrency(activeQuote.minimumOrderAmount)}.
                </Text>
              )}
            </View>
          )}

          {step === 'confirm' && activeQuote && (
            <View>
              <StepHeading step="confirm" title="Confirm booking" />
              <View style={styles.summaryCard}>
                <View style={styles.summaryShopRow}>
                  {form.autoDispatch ? (
                    <View style={styles.autoDispatchIcon}>
                      <Ionicons name="flash" size={18} color={colors.primary} />
                    </View>
                  ) : selectedShop?.logoUrl ? (
                    <Image
                      source={{ uri: resolveMediaUrl(selectedShop.logoUrl) }}
                      style={styles.shopLogo}
                    />
                  ) : (
                    <View style={styles.shopLogoFallback}>
                      <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.summaryShopTextGroup}>
                    <Text style={styles.summaryMuted}>Shop</Text>
                    <Text style={styles.summaryShopName}>
                      {form.autoDispatch
                        ? `${brandName}'s pick (best available)`
                        : (selectedBranch?.name ?? 'Selected shop')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>Service: </Text>
                  {activeQuote.serviceLabel}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>
                    {activeQuote.garmentSelections?.length
                      ? 'Garments: '
                      : activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
                        ? 'Bag size: '
                        : activeQuote.pricingMode === BranchPricingMode.FIXED
                          ? 'Pricing: '
                          : activeQuote.pricingMode === BranchPricingMode.PER_PIECE
                            ? 'Estimated pieces: '
                            : activeQuote.pricingMode === BranchPricingMode.PER_PAIR
                              ? 'Estimated pairs: '
                              : activeQuote.pricingMode === BranchPricingMode.PER_ITEM
                                ? 'Estimated items: '
                                : 'Estimated weight: '}
                  </Text>
                  {activeQuote.garmentSelections?.length
                    ? activeQuote.garmentSelections
                        .map((g) => `${GARMENT_CATALOG.find((c) => c.id === g.garmentId)?.label ?? g.garmentId} ×${g.quantity}`)
                        .join(', ')
                    : activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
                      ? `${activeQuote.bagLabel} (up to ${activeQuote.weightKg} kg)`
                      : activeQuote.pricingMode === BranchPricingMode.FIXED
                        ? 'Fixed price'
                        : activeQuote.pricingMode === BranchPricingMode.PER_PIECE
                          ? `${activeQuote.pieceCount ?? form.enteredPieceCount} pieces`
                          : activeQuote.pricingMode === BranchPricingMode.PER_PAIR
                            ? `${activeQuote.pieceCount ?? form.enteredPieceCount} pairs`
                            : activeQuote.pricingMode === BranchPricingMode.PER_ITEM
                              ? `${activeQuote.pieceCount ?? form.enteredPieceCount} items`
                              : `${activeQuote.weightKg} kg`}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>Pickup: </Text>
                  {form.scheduledPickupAt
                    ? new Intl.DateTimeFormat('en-PH', {
                        timeZone: 'Asia/Manila',
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(form.scheduledPickupAt))
                    : 'Selected pickup time'}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>
                    {activeQuote.isEstimate ? 'Estimated total: ' : 'Total: '}
                  </Text>
                  <Text style={styles.summaryTotal}>{formatCurrency(activeQuote.total)}</Text>
                </Text>
                {activeQuote.isEstimate ? (
                  <Text style={styles.optionSub}>
                    We&apos;ll confirm the actual weight/load count and final price at pickup.
                  </Text>
                ) : null}
              </View>
              <Text style={styles.confirmNote}>
                {form.autoDispatch
                  ? `After payment, ${brandName} dispatches your order to the best available shop nearby.`
                  : `Your order goes straight to ${selectedBranch?.name ?? 'your selected shop'} after payment.`}{' '}
                Pickup riders are notified once dispatched. Final amount may adjust after weigh-in.
              </Text>
              <PaymentMethodPicker
                method={paymentMethod}
                onMethodChange={setPaymentMethod}
                cashTiming={cashTiming}
                onCashTimingChange={setCashTiming}
                walletBalance={walletBalance}
                orderTotal={activeQuote.total}
                onTopUpWallet={() => router.push('/(tabs)/wallet')}
              />
            </View>
          )}

          <View style={styles.actions}>
            <Button label="Back" variant="outline" onPress={goBack} style={styles.secondaryBtn} />
            {step === 'confirm' ? (
              <Button
                label={payButtonLabel()}
                onPress={placeOrder}
                disabled={loading || insufficientWallet}
                style={styles.primaryBtn}
              />
            ) : (
              <Button
                label="Continue"
                onPress={goNext}
                disabled={reviewBlocked}
                style={styles.primaryBtn}
              />
            )}
          </View>
        </ScrollView>

      <BranchPickerSheet
        visible={branchSheetShopId !== null}
        shopName={shopOptions.find((s) => s.branchId === branchSheetShopId)?.name ?? ''}
        branches={shopOptions.find((s) => s.branchId === branchSheetShopId)?.branches ?? []}
        selectedBranchId={form.branchId}
        onSelect={(branchId) => {
          setReorderNotice('');
          setForm((f) => ({ ...f, branchId, autoDispatch: false }));
          setBranchSheetShopId(null);
        }}
        onClose={() => setBranchSheetShopId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  scroll: { flex: 1 },
  content: { padding: spacing.xl },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headingIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { ...typography.heading },
  sub: { ...typography.bodySm, marginBottom: spacing.md },
  error: { color: colors.destructive, marginBottom: spacing.md },
  errorBlock: { marginBottom: spacing.md, gap: spacing.sm },
  retryBtn: { alignSelf: 'flex-start' },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg - 2,
    marginBottom: spacing.md - 2,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionDisabled: { opacity: 0.4 },
  optionPressed: { opacity: 0.9 },
  optionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionTopRowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  optionCheck: { marginLeft: 'auto' },
  shopLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shopLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  shopCardSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.primaryLight,
    ...shadow.elevated,
  },
  shopCardFar: { opacity: 0.55 },
  shopCardDisabled: { opacity: 0.45 },
  shopCardPressed: { opacity: 0.92 },
  autoDispatchCard: { borderStyle: 'dashed' },
  autoDispatchIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  shopTitleGroup: { flexDirection: 'row', gap: spacing.md, flexShrink: 1, flex: 1 },
  shopTitleTextGroup: { flexShrink: 1, gap: 3, paddingTop: 1 },
  shopActionsGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.sm },
  shopFavBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  shopCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: { fontWeight: '700', fontSize: 16, color: colors.foreground },
  shopMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shopMetaText: { fontSize: 12.5, color: colors.muted, flexShrink: 1 },
  shopStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  statusPillOpen: { backgroundColor: colors.accentLight },
  statusPillClosed: { backgroundColor: colors.surfaceMuted },
  statusDot: { width: 6, height: 6, borderRadius: radius.full },
  statusDotOpen: { backgroundColor: colors.accentDark },
  statusDotClosed: { backgroundColor: colors.mutedForeground },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  statusPillTextOpen: { color: colors.accentDark },
  statusPillTextClosed: { color: colors.mutedForeground },
  shopPriceTag: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  branchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  branchChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  warnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.warningBg,
  },
  warnPillText: { fontSize: 12, fontWeight: '600', color: colors.warning },
  optionTitle: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  optionBadge: { fontWeight: '600', fontSize: 12, color: colors.accentDark },
  optionSub: { marginTop: spacing.xs, fontSize: 13, color: colors.muted },
  optionPrice: { marginTop: spacing.sm - 2, fontSize: 13, color: colors.primary, fontWeight: '500' },
  optionGpsMissing: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.warning, fontWeight: '500' },
  addonIncludedBadge: { marginTop: spacing.xs, fontSize: 12, color: colors.accentDark, fontWeight: '500' },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  defaultBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryDark },
  addonCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  addonCardBody: { flex: 1, minWidth: 0 },
  addonImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addonRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addonPrice: { fontSize: 15, fontWeight: '600', color: colors.primary },
  loadInfo: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '26',
    backgroundColor: colors.primary + '0D',
    gap: spacing.sm,
  },
  loadInfoText: { fontSize: 13, lineHeight: 20, color: colors.muted },
  loadInfoHighlight: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  weightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.lg,
  },
  weightService: { fontSize: 13, color: colors.muted },
  weightRange: { textAlign: 'center', fontSize: 12, color: colors.mutedForeground, marginTop: spacing.sm },
  promoCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  promoTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  promoInputRow: { flexDirection: 'row', gap: spacing.sm },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.surfaceMuted,
  },
  weightInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  weightCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  weightIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  weightCardDesc: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.muted },
  weightInputRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  weightInputLarge: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.foreground,
    backgroundColor: colors.surfaceMuted,
  },
  weightUnitChip: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  weightUnitChipText: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  weightReadoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  weightReadoutValue: { fontSize: 40, fontWeight: '700', color: colors.foreground },
  weightReadoutUnit: { fontSize: 16, fontWeight: '600', color: colors.muted },
  weightSlider: { width: '100%', height: 36, marginTop: spacing.xs },
  weightSliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing.xs },
  weightSliderLabelText: { fontSize: 12, color: colors.mutedForeground },
  weightHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  weightHintPillText: { fontSize: 12, fontWeight: '500', color: colors.muted },
  weightPriceTag: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  promoApplyBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  promoApplyText: { color: colors.onPrimary, fontWeight: '600', fontSize: 14 },
  promoAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  promoAppliedText: { flex: 1 },
  promoAppliedCode: { fontSize: 15, fontWeight: '700', color: colors.primary },
  promoAppliedSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  promoRemove: { fontSize: 13, fontWeight: '600', color: colors.primary },
  estimateCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  estimateLabel: { fontSize: 14, flex: 1, paddingRight: spacing.sm, color: colors.foreground },
  estimateLabelMuted: { fontSize: 14, color: colors.muted, flex: 1, paddingRight: spacing.sm },
  estimateDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md - 2,
    marginTop: spacing.xs,
    marginBottom: spacing.md - 2,
  },
  estimateTotalLabel: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  estimateTotal: { fontSize: 16, fontWeight: '700', color: colors.primary },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg - 2,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryLine: { fontSize: 14, color: colors.slate800 },
  summaryMuted: { color: colors.muted },
  summaryTotal: { fontWeight: '700' },
  summaryShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryShopTextGroup: { flexShrink: 1, gap: 2 },
  summaryShopName: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  shopContextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  confirmNote: { ...typography.caption, lineHeight: 18, marginBottom: spacing.md },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.slate700, lineHeight: 20 },
  weightValue: { fontSize: 32, fontWeight: '700', color: colors.primary },
  weightRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxxl, marginBottom: spacing.lg },
  weightBtnCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightBtnPressed: { opacity: 0.8 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
  secondaryBtn: { flex: 1 },
  primaryBtn: { flex: 2 },
  btnDisabled: { opacity: 0.6 },
  linkPressed: { opacity: 0.7 },
  garmentCategoryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  garmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  garmentRowFirst: { borderTopWidth: 0 },
  garmentQtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  garmentQtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentQtyValue: { minWidth: 24, textAlign: 'center', fontWeight: '600', fontSize: 15 },
});
