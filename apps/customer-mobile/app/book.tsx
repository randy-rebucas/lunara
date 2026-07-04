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
  EXPRESS_RETURN_ADDON_ID,
  formatMachineLoadLabel,
  calculateQuote,
  formatCurrency,
  formatAddressTypeLabel,
  isExpressReturnAllowed,
  type BookingAddonOption,
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
  minWeightKg: number;
  maxWeightKg: number;
}

interface ShopServiceOption {
  type: BookingType;
  label: string;
  basePricePerKg: number;
  customerPricePerKg: number;
}

interface ShopOption {
  branchId: string;
  code: string;
  name: string;
  city: string;
  distanceKm: number;
  distanceLabel: string;
  withinRadius: boolean;
  capacityAvailable: boolean;
  services: ShopServiceOption[];
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
  const { service: serviceParam, code: codeParam } = useLocalSearchParams<{
    service?: string;
    code?: string;
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
  const [areaLabel, setAreaLabel] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
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
        if (defaultAddress) setForm((f) => ({ ...f, addressId: defaultAddress._id }));
        setAddressesError('');
      })
      .catch((e) =>
        setAddressesError(e instanceof Error ? e.message : 'Could not load addresses'),
      );
  }, [apiFetch]);

  const selectedShop = shopOptions.find((s) => s.branchId === form.branchId);

  const localQuote = useMemo(() => {
    if (!form.bookingType) return null;
    const catalogService = config?.services.find((s) => s.type === form.bookingType);
    const shopService = selectedShop?.services.find((s) => s.type === form.bookingType);
    const service =
      catalogService && shopService
        ? { ...catalogService, pricePerKg: shopService.customerPricePerKg }
        : catalogService;
    try {
      return calculateQuote(
        {
          bookingType: form.bookingType,
          weightKg: form.weightKg,
          addonIds: form.addonIds,
        },
        service,
        config?.addons,
      );
    } catch {
      return null;
    }
  }, [form.bookingType, form.weightKg, form.addonIds, config?.services, config?.addons, selectedShop]);

  const loadAvailability = useCallback(
    async (addressId: string) => {
      setAvailabilityError('');
      setAvailabilityLoading(true);
      try {
        const avail = await apiFetch<{
          areaLabel: string;
          slots: PickupSlot[];
          dispatchNote?: string;
        }>(`/booking/availability?addressId=${encodeURIComponent(addressId)}`);
        setAreaLabel(avail.areaLabel);
        setSlots(avail.slots);
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
  }, [form.addressId, loadAvailability, loadShops]);

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
    if (!form.bookingType || !form.addressId || !form.branchId) return null;
    const q = await apiFetch<QuoteBreakdown>(
      `/booking/quote?addressId=${encodeURIComponent(form.addressId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          bookingType: form.bookingType,
          branchId: form.branchId,
          weightKg: form.weightKg,
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
    if (step === 'shop' && !form.branchId) {
      setError('Select a laundry shop');
      return;
    }
    if (step === 'schedule' && !form.scheduledPickupAt) {
      setError('Select a pickup slot');
      return;
    }
    if (step === 'weight' && localQuote && !localQuote.meetsMinimum) {
      setError(
        `Minimum order is ${formatCurrency(BOOKING_MIN_ORDER_AMOUNT)}. Increase weight or add add-ons.`,
      );
      return;
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
    if (!form.bookingType || !form.addressId || !form.branchId || !form.scheduledPickupAt) return;
    if (placingOrderRef.current) return;
    placingOrderRef.current = true;
    setLoading(true);
    setError('');
    try {
      const order = await apiFetch<{ _id: string; total: number }>('/booking/orders', {
        method: 'POST',
        body: JSON.stringify({
          bookingType: form.bookingType,
          branchId: form.branchId,
          weightKg: form.weightKg,
          addonIds: form.addonIds,
          pickupAddressId: form.addressId,
          scheduledPickupAt: form.scheduledPickupAt,
          ...(form.couponCode.trim() ? { couponCode: form.couponCode.trim() } : {}),
        }),
      });
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

      placingOrderRef.current = false;
      setError('Payment could not be started');
    } catch (e) {
      placingOrderRef.current = false;
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  const addons = config?.addons ?? [];
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
                      setForm((f) => ({ ...f, addressId: a._id, branchId: '', scheduledPickupAt: '' }))
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
              {shopsLoading ? (
                <Text style={styles.sub}>Finding nearby shops…</Text>
              ) : shopOptions.length === 0 ? (
                <Text style={styles.sub}>No partner shops are available near this address yet.</Text>
              ) : (
                shopOptions.map((shop) => {
                  const selected = form.branchId === shop.branchId;
                  const cheapest = shop.services.reduce<ShopServiceOption | null>(
                    (min, s) => (!min || s.customerPricePerKg < min.customerPricePerKg ? s : min),
                    null,
                  );
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
                      onPress={() => setForm((f) => ({ ...f, branchId: shop.branchId }))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled }}
                    >
                      <View style={styles.optionTopRow}>
                        <Text style={styles.optionTitle}>{shop.name}</Text>
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        ) : null}
                      </View>
                      <Text style={styles.optionSub}>
                        {shop.city} · {shop.distanceLabel}
                      </Text>
                      {cheapest ? (
                        <Text style={styles.optionPrice}>
                          From {formatCurrency(cheapest.customerPricePerKg)} / kg
                        </Text>
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
              {config.services.map((s) => {
                const selected = form.bookingType === s.type;
                const shopService = selectedShop?.services.find((sv) => sv.type === s.type);
                return (
                  <Pressable
                    key={s.type}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                    onPress={() => setForm((f) => ({ ...f, bookingType: s.type as BookingType }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.optionTopRow}>
                      <Text style={styles.optionTitle}>{s.label}</Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : null}
                    </View>
                    <Text style={styles.optionSub}>{s.description}</Text>
                    <Text style={styles.optionPrice}>
                      {formatCurrency(shopService?.customerPricePerKg ?? s.pricePerKg)} / kg · min {s.minWeightKg} kg
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

          {step === 'weight' && (
            <View>
              <StepHeading step="weight" title="Estimate weight" />
              <Text style={styles.sub}>
                We&apos;ll confirm actual weight at pickup. Min order{' '}
                {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
              </Text>
              <View style={styles.loadInfo}>
                <Text style={styles.loadInfoText}>{BOOKING_MACHINE_LOAD_INFO}</Text>
                <Text style={styles.loadInfoHighlight}>
                  Your estimate: {formatMachineLoadLabel(form.weightKg)}
                </Text>
              </View>
              <View style={styles.weightHeader}>
                <Text style={styles.weightValue}>{form.weightKg} kg</Text>
                {activeQuote ? (
                  <Text style={styles.weightService}>
                    Service: {formatCurrency(activeQuote.serviceSubtotal)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.weightRow}>
                <Pressable
                  style={({ pressed }) => [styles.weightBtnCircle, pressed && styles.weightBtnPressed]}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      weightKg: Math.max(config?.minWeightKg ?? 1, f.weightKg - 1),
                    }))
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Decrease weight by 1 kilogram"
                  hitSlop={4}
                >
                  <Ionicons name="remove" size={22} color={colors.primary} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.weightBtnCircle, pressed && styles.weightBtnPressed]}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      weightKg: Math.min(config?.maxWeightKg ?? 50, f.weightKg + 1),
                    }))
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Increase weight by 1 kilogram"
                  hitSlop={4}
                >
                  <Ionicons name="add" size={22} color={colors.primary} />
                </Pressable>
              </View>
              <Text style={styles.weightRange}>
                {config?.minWeightKg ?? 1} kg – {config?.maxWeightKg ?? 50} kg
              </Text>
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
                  const imageUri = resolveMediaUrl(a.imageUrl);
                  const isExpressReturn = a.id === EXPRESS_RETURN_ADDON_ID;
                  const disabled = isExpressReturn && !expressReturnAllowed;
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
                        {imageUri ? (
                          <Image source={{ uri: imageUri }} style={styles.addonImage} />
                        ) : (
                          <View style={styles.addonImagePlaceholder}>
                            <Ionicons
                              name={ADDON_ICONS[a.id] ?? ADDON_ICON_FALLBACK}
                              size={22}
                              color={colors.primary}
                            />
                          </View>
                        )}
                        <View style={styles.addonCardBody}>
                          <View style={styles.addonRow}>
                            <Text style={styles.optionTitle}>{a.label}</Text>
                            <View style={styles.addonRight}>
                              <Text style={styles.addonPrice}>+{formatCurrency(a.price)}</Text>
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
                    {activeQuote.serviceLabel} × {activeQuote.weightKg} kg
                  </Text>
                  <Text>{formatCurrency(activeQuote.serviceSubtotal)}</Text>
                </View>
                {activeQuote.addons.map((a) => (
                  <View key={a.id} style={styles.estimateRow}>
                    <Text style={styles.estimateLabelMuted}>{a.label}</Text>
                    <Text style={styles.estimateLabelMuted}>{formatCurrency(a.price)}</Text>
                  </View>
                ))}
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
                  {selectedShop?.name ?? 'Selected shop'}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>Weight: </Text>~{activeQuote.weightKg} kg
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>Pickup: </Text>
                  {slots.find((s) => s.startAt === form.scheduledPickupAt)?.label ?? 'Selected slot'}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryMuted}>Total: </Text>
                  <Text style={styles.summaryTotal}>{formatCurrency(activeQuote.total)}</Text>
                </Text>
              </View>
              <Text style={styles.confirmNote}>
                Your order goes straight to {selectedShop?.name ?? 'your selected shop'} after
                payment. Pickup riders are notified once dispatched. Final amount may adjust after
                weigh-in.
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
  optionCheck: { marginLeft: 'auto' },
  optionTitle: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  optionSub: { marginTop: spacing.xs, fontSize: 13, color: colors.muted },
  optionPrice: { marginTop: spacing.sm - 2, fontSize: 13, color: colors.primary, fontWeight: '500' },
  optionGps: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.accentDark, fontWeight: '500' },
  optionGpsMissing: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.warning, fontWeight: '500' },
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
  addonImage: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
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
