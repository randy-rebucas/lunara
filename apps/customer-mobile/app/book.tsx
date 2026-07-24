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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookingType, PaymentMethod } from '@lunara/types';
import {
  BOOKING_MACHINE_LOAD_INFO,
  BOOKING_MIN_ORDER_AMOUNT,
  BranchPricingMode,
  estimateMachineLoads,
  EXPRESS_RETURN_ADDON_ID,
  formatMachineLoadLabel,
  calculateQuote,
  formatCurrency,
  formatAddressTypeLabel,
  isExpressReturnAllowed,
  getTodayScheduleSummary,
  type BagSizeId,
  type BagSizeOption,
  type BookingAddonOption,
  type BranchHoliday,
  type CashTiming,
  type LaundryServiceOption,
  isPickupSlotBookable,
  type PickupSlot,
  type QuoteBreakdown,
} from '@lunara/utils';
import { resolveMediaUrl } from '../src/lib/media-url';
import { colors, radius, spacing, typography } from '../src/theme';
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
import { useAuthStore } from '../src/store/auth';

interface ReorderSourceOrder {
  _id: string;
  branchId?: string;
  bookingType: BookingType;
  bagSizeId?: string;
  addons?: { id: string }[];
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
  pricingUnit?: BranchPricingMode;
  customerPricePerKg: number;
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
  isCustom?: boolean;
  customAddonId?: string;
}

interface ShopBranchVariant {
  branchId: string;
  name: string;
  isMainShop: boolean;
  distanceKm: number;
  distanceLabel: string;
}

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
  capacityAvailable: boolean;
  logoUrl?: string;
  pricingMode: BranchPricingMode;
  operatingHours: { isClosed: boolean; openTime: string; closeTime: string }[];
  holidays: BranchHoliday[];
  services: ShopServiceOption[];
  addons: ShopAddonOption[];
  branches: ShopBranchVariant[];
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
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [holidays, setHolidays] = useState<BranchHoliday[]>([]);
  const [areaLabel, setAreaLabel] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
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
  }, [apiFetch, reorderParam]);

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
        "Your previous shop isn't available right now — choose another or let Lunara pick one for you.",
      );
    }
  }, [shopOptions, shopsLoading]);

  // A partner's other branches are listed under `shop.branches[]`, keyed by the nearest branch's
  // id (`shop.branchId`) — picking a non-nearest variant via BranchPickerSheet still needs to
  // resolve back to that shop's pricing/services (the API doesn't expose per-variant pricing).
  const selectedShop = shopOptions.find(
    (s) => s.branchId === form.branchId || s.branches.some((b) => b.branchId === form.branchId),
  );

  const services = useMemo(() => {
    if (selectedShop) {
      return selectedShop.services.map((s) => {
        const catalogMatch = config?.services.find((cs) => cs.type === s.type);
        return {
          type: s.type,
          label: s.label,
          description: s.description ?? catalogMatch?.description ?? '',
          pricePerKg: s.customerPricePerKg,
          basePricePerLoad: s.basePricePerLoad,
          basePricePerPiece: s.basePricePerPiece,
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
      pricingUnit: BranchPricingMode.FLAT_BAG,
      isCustom: false,
      customServiceId: undefined,
    }));
  }, [config, selectedShop]);

  const addons = useMemo(() => {
    if (selectedShop) {
      return selectedShop.addons.map((a) => {
        const catalogMatch = config?.addons.find((ca) => ca.id === a.slug);
        return {
          id: a.slug,
          label: a.label,
          description: a.description ?? catalogMatch?.description ?? '',
          price: a.customerPrice,
          pricingUnit: a.pricingUnit ?? BranchPricingMode.FLAT_BAG,
          imageUrl: catalogMatch?.imageUrl,
          isCustom: a.isCustom ?? false,
        };
      });
    }
    return (config?.addons ?? []).map((a) => ({
      ...a,
      pricingUnit: BranchPricingMode.FLAT_BAG,
      isCustom: false,
    }));
  }, [config, selectedShop]);

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

    if (shopPricingMode === BranchPricingMode.FLAT_BAG) {
      if (!form.bagSizeId) return null;
    } else if (shopPricingMode === BranchPricingMode.PER_KG) {
      if (!enteredWeightKg) return null;
    } else if (shopPricingMode === BranchPricingMode.PER_PIECE) {
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
        }))
      : config?.addons;

    try {
      return calculateQuote(
        {
          bookingType: form.bookingType,
          bagSizeId: form.bagSizeId || undefined,
          addonIds: form.addonIds,
          pricingMode: shopPricingMode,
          rates: {
            basePricePerKg: shopService?.basePricePerKg,
            basePricePerLoad: shopService?.basePricePerLoad,
            basePricePerPiece: shopService?.basePricePerPiece,
          },
          enteredWeightKg,
          enteredLoadCount,
          enteredPieceCount,
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
    form.addonIds,
    config?.services,
    config?.addons,
    selectedShop,
    selectedShopService,
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
          slots: PickupSlot[];
          holidays?: BranchHoliday[];
          dispatchNote?: string;
        }>(`/booking/availability?addressId=${encodeURIComponent(addressId)}${branchParam}`);
        setAreaLabel(avail.areaLabel);
        setSlots(avail.slots);
        setHolidays(avail.holidays ?? []);
        setDispatchNote(avail.dispatchNote ?? '');
        setForm((f) => {
          const stillValid = avail.slots.some(
            (s) => s.startAt === f.scheduledPickupAt && isPickupSlotBookable(s),
          );
          if (stillValid) return f;
          const first = avail.slots.find((s) => isPickupSlotBookable(s));
          return { ...f, scheduledPickupAt: first?.startAt ?? '' };
        });
      } catch (e) {
        setAvailabilityError(
          e instanceof Error ? e.message : 'Could not load pickup slots',
        );
        setSlots([]);
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
        setShopOptions(res ?? []);
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
          bookingType: form.bookingType,
          ...(form.branchId ? { branchId: form.branchId } : {}),
          ...(form.customServiceId ? { customServiceId: form.customServiceId } : {}),
          ...(form.bagSizeId ? { bagSizeId: form.bagSizeId } : {}),
          ...(Number(form.enteredWeightKg) ? { enteredWeightKg: Number(form.enteredWeightKg) } : {}),
          ...(Number(form.enteredLoadCount) ? { enteredLoadCount: Number(form.enteredLoadCount) } : {}),
          ...(Number(form.enteredPieceCount) ? { enteredPieceCount: Number(form.enteredPieceCount) } : {}),
          addonIds: form.addonIds,
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
    (Boolean(availabilityError) || slots.length === 0);

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
      setError('Select a laundry shop or let Lunara pick one for you');
      return;
    }
    if (step === 'schedule' && !form.scheduledPickupAt) {
      setError('Select a pickup slot');
      return;
    }
    if (step === 'weight') {
      if (shopPricingMode === BranchPricingMode.FLAT_BAG && !form.bagSizeId) {
        setError('Choose a bag size');
        return;
      }
      if (shopPricingMode === BranchPricingMode.PER_KG && !Number(form.enteredWeightKg)) {
        setError('Enter the estimated weight');
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
      if (shopPricingMode === BranchPricingMode.PER_PIECE && !Number(form.enteredPieceCount)) {
        setError('Enter the piece count');
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
          bookingType: form.bookingType,
          ...(form.branchId ? { branchId: form.branchId } : {}),
          ...(form.customServiceId ? { customServiceId: form.customServiceId } : {}),
          ...(form.bagSizeId ? { bagSizeId: form.bagSizeId } : {}),
          ...(Number(form.enteredWeightKg) ? { enteredWeightKg: Number(form.enteredWeightKg) } : {}),
          ...(Number(form.enteredLoadCount) ? { enteredLoadCount: Number(form.enteredLoadCount) } : {}),
          ...(Number(form.enteredPieceCount) ? { enteredPieceCount: Number(form.enteredPieceCount) } : {}),
          addonIds: form.addonIds,
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
                  <Text style={styles.infoText}>{dispatchNote}</Text>
                </View>
              ) : null}
              {addresses.length === 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  onPress={() => router.push('/(tabs)/profile')}
                  accessibilityRole="button"
                  accessibilityLabel="Add address in Profile"
                >
                  <Text style={styles.optionTitle}>Add address in Profile</Text>
                  <Text style={styles.optionSub}>
                    Save a pickup address with GPS so riders can navigate to you
                  </Text>
                </Pressable>
              ) : (
                addresses.map((a) => {
                  const selected = form.addressId === a._id;
                  return (
                  <Pressable
                    key={a._id}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      !addressHasCoords(a) && styles.optionDisabled,
                      pressed && styles.optionPressed,
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
                    <View style={styles.addressLabelRow}>
                      <Text style={styles.optionTitle}>{a.label}</Text>
                      {a.isDefault ? (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      ) : null}
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={styles.optionCheck} />
                      ) : null}
                    </View>
                    <Text style={styles.optionSub}>
                      {formatAddressTypeLabel(a.addressType)} · {a.line1}, {a.city}
                    </Text>
                    {addressHasCoords(a) ? (
                      <Text style={styles.optionGps}>GPS pinned for rider navigation</Text>
                    ) : (
                      <Text style={styles.optionGpsMissing}>
                        No GPS pin — update in Profile before booking
                      </Text>
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
              {!shopsLoading && shopOptions.length > 0 ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.option,
                    form.autoDispatch && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}
                  onPress={() => {
                    setReorderNotice('');
                    setForm((f) => ({ ...f, autoDispatch: true, branchId: '' }));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: form.autoDispatch }}
                >
                  <View style={styles.optionTopRow}>
                    <View style={styles.optionTitleRow}>
                      <View style={styles.shopLogoFallback}>
                        <Ionicons name="flash-outline" size={18} color={colors.primary} />
                      </View>
                      <Text style={styles.optionTitle}>Let Lunara pick a shop for you</Text>
                    </View>
                    {form.autoDispatch ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </View>
                  <Text style={styles.optionSub}>
                    We'll dispatch to the best available shop nearby — useful when your usual shops are full.
                  </Text>
                </Pressable>
              ) : null}
              {shopsLoading ? (
                <Text style={styles.sub}>Finding nearby shops…</Text>
              ) : shopOptions.length === 0 ? (
                <Text style={styles.sub}>No partner shops are available near this address yet.</Text>
              ) : (
                shopOptions.map((shop) => {
                  const selected =
                    !form.autoDispatch &&
                    (form.branchId === shop.branchId ||
                      shop.branches.some((b) => b.branchId === form.branchId));
                  // Services on the same shop can each bill in a different unit now, so
                  // "cheapest" is computed per-service in its own unit, not one shop-wide unit.
                  const flatBagFrom = config?.bagSizes?.length
                    ? Math.min(...config.bagSizes.map((b) => b.price))
                    : undefined;
                  const candidates = shop.services
                    .map((s) => {
                      const unit = s.pricingUnit ?? BranchPricingMode.FLAT_BAG;
                      if (unit === BranchPricingMode.PER_LOAD && s.basePricePerLoad != null) {
                        return { amount: s.basePricePerLoad, suffix: ' / load' };
                      }
                      if (unit === BranchPricingMode.PER_PIECE && s.basePricePerPiece != null) {
                        return { amount: s.basePricePerPiece, suffix: ' / piece' };
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
                  const cheapestCandidate = candidates.reduce<{ amount: number; suffix: string } | null>(
                    (min, c) => (!min || c.amount < min.amount ? c : min),
                    null,
                  );
                  const startingPriceLabel = cheapestCandidate
                    ? `From ${formatCurrency(cheapestCandidate.amount)}${cheapestCandidate.suffix}`
                    : null;
                  const schedule = getTodayScheduleSummary(shop.operatingHours, shop.holidays);
                  const disabled = !shop.withinRadius || !shop.capacityAvailable;
                  return (
                    <Pressable
                      key={shop.branchId}
                      disabled={disabled}
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionSelected,
                        disabled && styles.optionDisabled,
                        pressed && !disabled && styles.optionPressed,
                      ]}
                      onPress={() => {
                        setReorderNotice('');
                        setForm((f) => ({ ...f, branchId: shop.branchId, autoDispatch: false }));
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled }}
                    >
                      <View style={styles.optionTopRow}>
                        <View style={styles.optionTitleRow}>
                          {shop.logoUrl ? (
                            <Image
                              source={{ uri: resolveMediaUrl(shop.logoUrl) }}
                              style={styles.shopLogo}
                            />
                          ) : (
                            <View style={styles.shopLogoFallback}>
                              <Ionicons name="storefront-outline" size={18} color={colors.primary} />
                            </View>
                          )}
                          <Text style={styles.optionTitle}>{shop.name}</Text>
                        </View>
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        ) : null}
                      </View>
                      <Text style={styles.optionSub}>
                        {shop.city} · {shop.distanceLabel}
                      </Text>
                      <Text style={schedule.isOpenNow ? styles.scheduleOpen : styles.scheduleClosed}>
                        {schedule.label}
                      </Text>
                      {shop.branches.length > 1 ? (
                        <Pressable
                          onPress={() => setBranchSheetShopId(shop.branchId)}
                          hitSlop={8}
                          accessibilityRole="button"
                        >
                          <Text style={styles.optionBranchLink}>
                            {shop.branches.length} branches near you — choose one
                          </Text>
                        </Pressable>
                      ) : null}
                      {startingPriceLabel ? (
                        <Text style={styles.optionPrice}>{startingPriceLabel}</Text>
                      ) : null}
                      {!shop.capacityAvailable ? (
                        <Text style={styles.optionGpsMissing}>Currently at capacity</Text>
                      ) : null}
                      {!shop.withinRadius ? (
                        <Text style={styles.optionGpsMissing}>Outside delivery range</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}

          {step === 'service' && config && (
            <View>
              <StepHeading
                step="service"
                title={selectedShop ? `${selectedShop.name} services` : 'Choose service'}
              />
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
              {slots.length === 0 && !availabilityError ? (
                <Text style={styles.sub}>No pickup slots available for this address.</Text>
              ) : null}
              {slots.length > 0 ? (
                <PickupSchedulePicker
                  slots={slots}
                  selectedStartAt={form.scheduledPickupAt}
                  onSelectStartAt={(startAt) => setForm((f) => ({ ...f, scheduledPickupAt: startAt }))}
                  holidays={holidays}
                />
              ) : null}
              {showScheduleSupport ? (
                <ScheduleSupportPrompt
                  address={selectedAddress}
                  reason={availabilityError || 'No pickup slots are available for this address yet.'}
                />
              ) : null}
            </View>
          )}

          {step === 'weight' && shopPricingMode === BranchPricingMode.FLAT_BAG && (
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

          {step === 'weight' && shopPricingMode === BranchPricingMode.PER_KG && (
            <View>
              <StepHeading step="weight" title="Estimate your weight" />
              <Text style={styles.sub}>
                This shop charges per kilo. Enter an estimate now — we&apos;ll confirm the actual
                weight and final price at pickup. Min order{' '}
                {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
              </Text>
              <TextInput
                style={styles.weightInput}
                keyboardType="decimal-pad"
                placeholder="e.g. 6"
                value={form.enteredWeightKg}
                onChangeText={(v) => setForm((f) => ({ ...f, enteredWeightKg: v }))}
              />
              <Text style={styles.optionSub}>kg</Text>
              {localQuote ? (
                <Text style={styles.optionPrice}>
                  Estimated: {formatCurrency(localQuote.serviceSubtotal)}
                </Text>
              ) : null}
            </View>
          )}

          {step === 'weight' && shopPricingMode === BranchPricingMode.PER_LOAD && (
            <View>
              <StepHeading step="weight" title="Estimate your load count" />
              <Text style={styles.sub}>
                This shop charges per machine load. Enter your estimated weight (or load count
                directly) — we&apos;ll confirm the actual load count and final price at pickup.{' '}
                {BOOKING_MACHINE_LOAD_INFO} Min order{' '}
                {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
              </Text>
              <TextInput
                style={styles.weightInput}
                keyboardType="decimal-pad"
                placeholder="Estimated weight (kg)"
                value={form.enteredWeightKg}
                onChangeText={(v) =>
                  setForm((f) => ({
                    ...f,
                    enteredWeightKg: v,
                    enteredLoadCount: v ? String(estimateMachineLoads(Number(v) || 0)) : '',
                  }))
                }
              />
              <Text style={styles.optionSub}>
                {form.enteredLoadCount
                  ? `${form.enteredLoadCount} machine load${Number(form.enteredLoadCount) === 1 ? '' : 's'}`
                  : 'kg'}
              </Text>
              {localQuote ? (
                <Text style={styles.optionPrice}>
                  Estimated: {formatCurrency(localQuote.serviceSubtotal)}
                </Text>
              ) : null}
            </View>
          )}

          {step === 'weight' && shopPricingMode === BranchPricingMode.PER_PIECE && (
            <View>
              <StepHeading step="weight" title="Estimate your piece count" />
              <Text style={styles.sub}>
                This shop charges per piece. Enter an estimated piece count now — we&apos;ll
                confirm the actual count and final price at pickup. Min order{' '}
                {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
              </Text>
              <TextInput
                style={styles.weightInput}
                keyboardType="number-pad"
                placeholder="e.g. 4"
                value={form.enteredPieceCount}
                onChangeText={(v) => setForm((f) => ({ ...f, enteredPieceCount: v }))}
              />
              <Text style={styles.optionSub}>pieces</Text>
              {localQuote ? (
                <Text style={styles.optionPrice}>
                  Estimated: {formatCurrency(localQuote.serviceSubtotal)}
                </Text>
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
                          : '';
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
                        }))
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled }}
                    >
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
                                +{formatCurrency(a.price)}
                                {unitSuffix}
                              </Text>
                              {selected ? (
                                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                              ) : null}
                            </View>
                          </View>
                          <Text style={styles.optionSub}>{a.description}</Text>
                          {disabled ? (
                            <Text style={styles.optionGpsMissing}>
                              Not available for pickups at 3:00 PM or later
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
              {shopPricingMode !== BranchPricingMode.PER_PIECE &&
              form.addonIds.some(
                (id) => addons.find((a) => a.id === id)?.pricingUnit === BranchPricingMode.PER_PIECE,
              ) ? (
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
                  const detail =
                    a.unit === BranchPricingMode.PER_KG
                      ? `${a.label} (${a.quantity ?? 0} kg)`
                      : a.unit === BranchPricingMode.PER_LOAD
                        ? `${a.label} (×${a.quantity ?? 0} load${a.quantity === 1 ? '' : 's'})`
                        : a.unit === BranchPricingMode.PER_PIECE
                          ? `${a.label} (×${a.quantity ?? 0} piece${a.quantity === 1 ? '' : 's'})`
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
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>Service: </Text>
                  {activeQuote.serviceLabel}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>Shop: </Text>
                  {form.autoDispatch ? "Lunara's pick (best available)" : selectedShop?.name ?? 'Selected shop'}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>
                    {activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
                      ? 'Bag size: '
                      : activeQuote.pricingMode === BranchPricingMode.PER_PIECE
                        ? 'Estimated pieces: '
                        : 'Estimated weight: '}
                  </Text>
                  {activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
                    ? `${activeQuote.bagLabel} (up to ${activeQuote.weightKg} kg)`
                    : activeQuote.pricingMode === BranchPricingMode.PER_PIECE
                      ? `${activeQuote.pieceCount ?? form.enteredPieceCount} pieces`
                      : `${activeQuote.weightKg} kg`}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>Pickup: </Text>
                  {slots.find((s) => s.startAt === form.scheduledPickupAt)?.label ?? 'Selected slot'}
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
                  ? "After payment, Lunara dispatches your order to the best available shop nearby."
                  : `Your order goes straight to ${selectedShop?.name ?? 'your selected shop'} after payment.`}{' '}
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
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  optionCheck: { marginLeft: 'auto' },
  shopLogo: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.surface },
  shopLogoFallback: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  optionBadge: { fontWeight: '600', fontSize: 12, color: colors.accentDark },
  optionSub: { marginTop: spacing.xs, fontSize: 13, color: colors.muted },
  optionPrice: { marginTop: spacing.sm - 2, fontSize: 13, color: colors.primary, fontWeight: '500' },
  optionGps: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.accentDark, fontWeight: '500' },
  optionGpsMissing: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.warning, fontWeight: '500' },
  scheduleOpen: { marginTop: spacing.xs, fontSize: 12, color: colors.accentDark, fontWeight: '500' },
  scheduleClosed: { marginTop: spacing.xs, fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
  optionBranchLink: {
    marginTop: spacing.sm - 2,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
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
  confirmNote: { ...typography.caption, lineHeight: 18, marginBottom: spacing.md },
  infoBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: { fontSize: 13, color: colors.slate700, lineHeight: 20 },
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
});
