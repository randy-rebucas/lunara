import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { NearestBranchesCard, type NearestBranchRow } from '../src/components/nearest-branches';
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

interface BookingConfig {
  services: LaundryServiceOption[];
  addons: BookingAddonOption[];
  minOrderAmount: number;
  minWeightKg: number;
  maxWeightKg: number;
}

export default function BookScreen() {
  const router = useRouter();
  const { service: serviceParam, code: codeParam } = useLocalSearchParams<{
    service?: string;
    code?: string;
  }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [step, setStep] = useState<BookingStep>('service');
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
  const [nearestBranches, setNearestBranches] = useState<NearestBranchRow[]>([]);
  const [nearestNote, setNearestNote] = useState('');
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.GCASH);
  const [cashTiming, setCashTiming] = useState<CashTiming>('pickup');
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
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

  const localQuote = useMemo(() => {
    if (!form.bookingType) return null;
    const service = config?.services.find((s) => s.type === form.bookingType);
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
  }, [form.bookingType, form.weightKg, form.addonIds, config?.services, config?.addons]);

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

  const loadNearestBranches = useCallback(
    async (addressId: string) => {
      try {
        const res = await apiFetch<{
          ranked: NearestBranchRow[];
          note?: string;
        }>(`/branches/nearest?addressId=${encodeURIComponent(addressId)}`);
        setNearestBranches(res.ranked ?? []);
        setNearestNote(res.note ?? '');
      } catch {
        setNearestBranches([]);
        setNearestNote('');
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    if (!form.addressId) return;
    loadAvailability(form.addressId);
    loadNearestBranches(form.addressId);
  }, [form.addressId, loadAvailability, loadNearestBranches]);

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
    if (!form.bookingType || !form.addressId) return null;
    const q = await apiFetch<QuoteBreakdown>(
      `/booking/quote?addressId=${encodeURIComponent(form.addressId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          bookingType: form.bookingType,
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

  async function placeOrder() {
    if (!form.bookingType || !form.addressId || !form.scheduledPickupAt) return;
    setLoading(true);
    setError('');
    try {
      await refreshQuote();
      const order = await apiFetch<{ _id: string; total: number }>('/booking/orders', {
        method: 'POST',
        body: JSON.stringify({
          bookingType: form.bookingType,
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
          'Payment received. Lunara will assign your partner branch shortly.',
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
              : 'Pay cash as arranged. Lunara will assign your partner branch shortly.'),
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

      setError('Payment could not be started');
    } catch (e) {
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {configLoading && !config ? (
          <Text style={styles.sub}>Loading services…</Text>
        ) : null}

      {step === 'service' && config && (
        <View>
          <Text style={styles.heading}>Choose service</Text>
          {config.services.map((s) => (
            <Pressable
              key={s.type}
              style={[
                styles.option,
                form.bookingType === s.type && styles.optionSelected,
              ]}
              onPress={() => setForm((f) => ({ ...f, bookingType: s.type as BookingType }))}
            >
              <Text style={styles.optionTitle}>{s.label}</Text>
              <Text style={styles.optionSub}>{s.description}</Text>
              <Text style={styles.optionPrice}>
                {formatCurrency(s.pricePerKg)} / kg · min {s.minWeightKg} kg
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {step === 'address' && (
        <View>
          <Text style={styles.heading}>Pickup address</Text>
          {addressesError ? <Text style={styles.error}>{addressesError}</Text> : null}
          {dispatchNote ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{dispatchNote}</Text>
            </View>
          ) : null}
          {addresses.length === 0 ? (
            <Pressable style={styles.option} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.optionTitle}>Add address in Profile</Text>
              <Text style={styles.optionSub}>
                Save a pickup address with GPS so riders can navigate to you
              </Text>
            </Pressable>
          ) : (
            addresses.map((a) => (
              <Pressable
                key={a._id}
                style={[
                  styles.option,
                  form.addressId === a._id && styles.optionSelected,
                  !addressHasCoords(a) && styles.optionDisabled,
                ]}
                onPress={() =>
                  setForm((f) => ({ ...f, addressId: a._id, scheduledPickupAt: '' }))
                }
              >
                <View style={styles.addressLabelRow}>
                  <Text style={styles.optionTitle}>{a.label}</Text>
                  {a.isDefault ? (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
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
            ))
          )}
          {form.addressId ? (
            <NearestBranchesCard branches={nearestBranches} note={nearestNote} />
          ) : null}
        </View>
      )}

      {step === 'schedule' && (
        <View>
          <Text style={styles.heading}>Pickup time</Text>
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
          <Text style={styles.heading}>Estimate weight</Text>
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
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  weightKg: Math.max(config?.minWeightKg ?? 1, f.weightKg - 1),
                }))
              }
            >
              <Text style={styles.weightBtn}>−</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  weightKg: Math.min(config?.maxWeightKg ?? 50, f.weightKg + 1),
                }))
              }
            >
              <Text style={styles.weightBtn}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.weightRange}>
            {config?.minWeightKg ?? 1} kg – {config?.maxWeightKg ?? 50} kg
          </Text>
        </View>
      )}

      {step === 'addons' && (
        <View>
          <Text style={styles.heading}>Add-ons (optional)</Text>
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
                  style={[
                    styles.option,
                    selected && styles.optionSelected,
                    disabled && styles.optionDisabled,
                  ]}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      addonIds: selected
                        ? f.addonIds.filter((id) => id !== a.id)
                        : [...f.addonIds, a.id],
                    }))
                  }
                >
                  <View style={styles.addonCardRow}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.addonImage} />
                    ) : null}
                    <View style={styles.addonCardBody}>
                      <View style={styles.addonRow}>
                        <Text style={styles.optionTitle}>{a.label}</Text>
                        <Text style={styles.addonPrice}>+{formatCurrency(a.price)}</Text>
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
          <Text style={styles.heading}>Price estimate</Text>
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
                <Pressable onPress={() => void removePromoCode()} disabled={promoLoading}>
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
          <Text style={styles.heading}>Confirm booking</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLine}>
              <Text style={styles.summaryMuted}>Service: </Text>
              {activeQuote.serviceLabel}
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
            Lunara operations assigns your partner branch after payment. Pickup riders are
            notified once dispatched. Final amount may adjust after weigh-in.
          </Text>
          {nearestBranches.length > 0 && (
            <NearestBranchesCard branches={nearestBranches} note={nearestNote} />
          )}
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
        <Pressable style={styles.secondaryBtn} onPress={goBack}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
        {step === 'confirm' ? (
          <Pressable
            style={[
              styles.primaryBtn,
              (loading || insufficientWallet) && styles.btnDisabled,
            ]}
            onPress={placeOrder}
            disabled={loading || insufficientWallet}
          >
            <Text style={styles.primaryBtnText}>{payButtonLabel()}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryBtn, reviewBlocked && styles.btnDisabled]}
            onPress={goNext}
            disabled={reviewBlocked}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl + spacing.sm },
  heading: { ...typography.heading, marginBottom: spacing.md },
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
  addonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  weightBtn: { fontSize: 32, fontWeight: '600', color: colors.primary, padding: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
  secondaryBtn: {
    flex: 1,
    padding: spacing.lg - 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryBtnText: { fontWeight: '600', color: colors.foreground },
  primaryBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    padding: spacing.lg - 2,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.onPrimary, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
});
