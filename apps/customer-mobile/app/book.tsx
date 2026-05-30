import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BookingType, PaymentMethod } from '@lunara/types';
import {
  BOOKING_MIN_ORDER_AMOUNT,
  calculateQuote,
  formatCurrency,
  type BookingAddonOption,
  type CashTiming,
  type LaundryServiceOption,
  type PickupSlot,
  type QuoteBreakdown,
} from '@lunara/utils';
import { theme } from '@lunara/config';
import { NearestBranchesCard, type NearestBranchRow } from '../src/components/nearest-branches';
import { PaymentMethodPicker } from '../src/components/payment-method-picker';
import {
  BOOKING_STEPS,
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
  line1: string;
  city: string;
  province: string;
  postalCode: string;
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
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [step, setStep] = useState<BookingStep>('service');
  const [form, setForm] = useState<BookingFormState>(initialBookingForm);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [areaLabel, setAreaLabel] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [nearestBranches, setNearestBranches] = useState<NearestBranchRow[]>([]);
  const [nearestNote, setNearestNote] = useState('');
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.GCASH);
  const [cashTiming, setCashTiming] = useState<CashTiming>('pickup');
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const [addressesError, setAddressesError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');

  useEffect(() => {
    setConfigLoading(true);
    apiFetch<BookingConfig>('/booking/config')
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load services'))
      .finally(() => setConfigLoading(false));
    apiFetch<AddressOption[]>('/addresses')
      .then((list) => {
        setAddresses(list);
        if (list[0]) setForm((f) => ({ ...f, addressId: list[0]._id }));
        setAddressesError('');
      })
      .catch((e) =>
        setAddressesError(e instanceof Error ? e.message : 'Could not load addresses'),
      );
  }, [apiFetch]);

  const localQuote = useMemo(() => {
    if (!form.bookingType) return null;
    try {
      return calculateQuote({
        bookingType: form.bookingType,
        weightKg: form.weightKg,
        addonIds: form.addonIds,
      });
    } catch {
      return null;
    }
  }, [form.bookingType, form.weightKg, form.addonIds]);

  const loadAvailability = useCallback(
    async (addressId: string) => {
      setAvailabilityError('');
      try {
        const avail = await apiFetch<{
          areaLabel: string;
          slots: PickupSlot[];
          dispatchNote?: string;
        }>(`/booking/availability?addressId=${encodeURIComponent(addressId)}`);
        setAreaLabel(avail.areaLabel);
        setSlots(avail.slots);
        setDispatchNote(avail.dispatchNote ?? '');
        if (avail.slots[0] && !form.scheduledPickupAt) {
          setForm((f) => ({ ...f, scheduledPickupAt: avail.slots[0].startAt }));
        }
      } catch (e) {
        setAvailabilityError(
          e instanceof Error ? e.message : 'Could not load pickup slots',
        );
        setSlots([]);
      }
    },
    [apiFetch, form.scheduledPickupAt],
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

  async function refreshQuote() {
    if (!form.bookingType || !form.addressId) return null;
    const q = await apiFetch<QuoteBreakdown>(
      `/booking/quote?addressId=${encodeURIComponent(form.addressId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          bookingType: form.bookingType,
          weightKg: form.weightKg,
          addonIds: form.addonIds,
        }),
      },
    );
    setQuote(q);
    return q;
  }

  async function goNext() {
    setError('');
    if (step === 'service' && !form.bookingType) {
      setError('Select a service');
      return;
    }
    if (step === 'address' && !form.addressId) {
      setError('Select an address');
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

  const stepIdx = BOOKING_STEPS.findIndex((s) => s.id === step);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.progress}>
        {BOOKING_STEPS.map((s, i) => (
          <Text
            key={s.id}
            style={[styles.progressDot, i <= stepIdx && styles.progressDotActive]}
          >
            {s.label}
          </Text>
        ))}
      </View>

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
            <Pressable
              style={styles.option}
              onPress={async () => {
                const addr = await apiFetch<AddressOption>('/addresses', {
                  method: 'POST',
                  body: JSON.stringify({
                    label: 'Home',
                    line1: '123 Mobile St',
                    city: 'Makati',
                    province: 'Metro Manila',
                    postalCode: '1200',
                    isDefault: true,
                  }),
                });
                setAddresses([addr]);
                setForm((f) => ({ ...f, addressId: addr._id }));
              }}
            >
              <Text style={styles.optionTitle}>Add demo address (Makati)</Text>
            </Pressable>
          ) : (
            addresses.map((a) => (
              <Pressable
                key={a._id}
                style={[
                  styles.option,
                  form.addressId === a._id && styles.optionSelected,
                ]}
                onPress={() =>
                  setForm((f) => ({ ...f, addressId: a._id, scheduledPickupAt: '' }))
                }
              >
                <Text style={styles.optionTitle}>{a.label}</Text>
                <Text style={styles.optionSub}>
                  {a.line1}, {a.city}
                </Text>
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
          {availabilityError ? <Text style={styles.error}>{availabilityError}</Text> : null}
          {areaLabel ? <Text style={styles.sub}>Serving: {areaLabel}</Text> : null}
          {slots.length === 0 && !availabilityError ? (
            <Text style={styles.sub}>No pickup slots available for this address.</Text>
          ) : null}
          {slots.map((slot) => (
            <Pressable
              key={slot.id}
              disabled={!slot.available}
              style={[
                styles.option,
                form.scheduledPickupAt === slot.startAt && styles.optionSelected,
                !slot.available && styles.optionDisabled,
              ]}
              onPress={() => setForm((f) => ({ ...f, scheduledPickupAt: slot.startAt }))}
            >
              <Text style={styles.optionTitle}>{slot.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {step === 'weight' && (
        <View>
          <Text style={styles.heading}>Estimate weight</Text>
          <Text style={styles.sub}>
            We'll confirm actual weight at pickup. Min order{' '}
            {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
          </Text>
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
              return (
                <Pressable
                  key={a.id}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      addonIds: selected
                        ? f.addonIds.filter((id) => id !== a.id)
                        : [...f.addonIds, a.id],
                    }))
                  }
                >
                  <View style={styles.addonRow}>
                    <Text style={styles.optionTitle}>{a.label}</Text>
                    <Text style={styles.addonPrice}>+{formatCurrency(a.price)}</Text>
                  </View>
                  <Text style={styles.optionSub}>{a.description}</Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {step === 'review' && activeQuote && (
        <View>
          <Text style={styles.heading}>Price estimate</Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  progress: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  progressDot: { fontSize: 10, color: '#94a3b8', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  progressDotActive: { color: '#fff', backgroundColor: theme.colors.primary },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  sub: { color: '#64748b', marginBottom: 12 },
  error: { color: '#ef4444', marginBottom: 12 },
  option: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  optionSelected: { borderColor: theme.colors.primary, backgroundColor: '#eef2ff' },
  optionDisabled: { opacity: 0.4 },
  optionTitle: { fontWeight: '600', fontSize: 16 },
  optionSub: { marginTop: 4, fontSize: 13, color: '#64748b' },
  optionPrice: { marginTop: 6, fontSize: 13, color: theme.colors.primary, fontWeight: '500' },
  addonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addonPrice: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  weightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  weightService: { fontSize: 13, color: '#64748b' },
  weightRange: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 8 },
  estimateCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
  },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  estimateLabel: { fontSize: 14, flex: 1, paddingRight: 8 },
  estimateLabelMuted: { fontSize: 14, color: '#64748b', flex: 1, paddingRight: 8 },
  estimateDivider: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  estimateTotalLabel: { fontSize: 16, fontWeight: '700' },
  estimateTotal: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  summaryLine: { fontSize: 14, color: '#1e293b' },
  summaryMuted: { color: '#64748b' },
  summaryTotal: { fontWeight: '700' },
  confirmNote: { fontSize: 12, color: '#64748b', lineHeight: 18, marginBottom: 12 },
  infoBox: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoText: { fontSize: 13, color: '#334155', lineHeight: 20 },
  weightValue: { fontSize: 32, fontWeight: '700', color: theme.colors.primary },
  weightRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 16 },
  weightBtn: { fontSize: 32, fontWeight: '600', color: theme.colors.primary, padding: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  secondaryBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  secondaryBtnText: { fontWeight: '600' },
  primaryBtn: {
    flex: 2,
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
});
