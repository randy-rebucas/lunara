'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookingType } from '@lunara/types';
import { Button } from '@lunara/ui';
import { ButtonLink } from '../ui/button-link';
import {
  BOOKING_MIN_ORDER_AMOUNT,
  calculateQuote,
  formatCurrency,
  type BookingAddonOption,
  type LaundryServiceOption,
  type PartnerCoverageInfo,
  type PickupSlot,
  type QuoteBreakdown,
} from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { NearestBranchesCard, type NearestBranchRow } from '../nearest-branches-card';
import { OrderPartnerCoverageNotice } from '../order-partner-coverage-notice';
import { ScheduleSupportPrompt } from '../schedule-support-prompt';
import { formatAvailabilityLoadError } from '../../lib/booking-availability-error';
import { loadCustomerSettings } from '../../lib/customer-settings';
import {
  BOOKING_STEPS,
  initialBookingForm,
  nextStep,
  prevStep,
  type BookingFormState,
  type BookingStep,
} from '../../lib/booking-flow';
import { PickupSchedulePicker } from './pickup-schedule-picker';
import { QuoteBreakdownPanel } from './quote-breakdown';

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
  deliveryFee: number;
}

function BookingProgress({ current }: { current: BookingStep }) {
  const currentIndex = BOOKING_STEPS.findIndex((s) => s.id === current);
  const currentStep = BOOKING_STEPS[currentIndex];

  return (
    <div className="mb-8">
      <p className="mb-3 text-sm text-muted">
        Step {currentIndex + 1} of {BOOKING_STEPS.length}
        {currentStep ? ` · ${currentStep.label}` : ''}
      </p>
      <nav className="overflow-x-auto pb-1">
        <ol className="flex min-w-max items-center gap-1 sm:gap-2">
          {BOOKING_STEPS.map((s, index) => {
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <li key={s.id} className="flex items-center gap-1 sm:gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    done
                      ? 'bg-accent text-white'
                      : active
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-slate-200 text-muted'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
                <span
                  className={`hidden text-xs sm:inline sm:text-sm ${
                    active ? 'font-semibold text-slate-900' : 'text-muted'
                  }`}
                >
                  {s.label}
                </span>
                {index < BOOKING_STEPS.length - 1 && (
                  <span
                    className={`hidden h-px w-3 sm:block sm:w-5 ${done ? 'bg-accent/40' : 'bg-border'}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

function StepHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
    </header>
  );
}

function WizardError({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200/80">
      {message}
    </div>
  );
}

function SelectableOption({
  selected,
  disabled,
  compact,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-lg bg-surface text-left ring-1 ring-border/50 transition-all hover:ring-border disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? 'p-3 text-sm' : 'p-4'
      } ${selected ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {selected && (
          <span className="badge-primary shrink-0" aria-hidden>
            Selected
          </span>
        )}
      </div>
    </button>
  );
}

function SummaryRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${emphasis ? 'text-base font-bold' : 'text-sm'}`}>
      <dt className={emphasis ? 'text-slate-900' : 'text-muted'}>{label}</dt>
      <dd className={emphasis ? 'text-primary' : 'text-slate-900'}>{value}</dd>
    </div>
  );
}

function getNextStepLabel(step: BookingStep): string {
  switch (step) {
    case 'service':
      return 'Continue to address';
    case 'address':
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

function canProceedStep(
  step: BookingStep,
  form: BookingFormState,
  localQuote: QuoteBreakdown | null,
  addresses: AddressOption[],
  slots: PickupSlot[],
): boolean {
  switch (step) {
    case 'service':
      return Boolean(form.bookingType);
    case 'address':
      return Boolean(form.addressId) && addresses.length > 0;
    case 'schedule':
      return Boolean(form.scheduledPickupAt) && slots.some((slot) => slot.available);
    case 'weight':
      return Boolean(localQuote?.meetsMinimum);
    case 'addons':
      return true;
    case 'review':
      return Boolean(localQuote?.meetsMinimum);
    default:
      return false;
  }
}

function WizardActions({
  step,
  loading,
  stepping,
  activeQuote,
  canProceed,
  onBack,
  onNext,
  onConfirm,
}: {
  step: BookingStep;
  loading: boolean;
  stepping: boolean;
  activeQuote: QuoteBreakdown | null;
  canProceed: boolean;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
}) {
  const isFirstStep = step === 'service';
  const isConfirmStep = step === 'confirm';
  const primaryDisabled = isConfirmStep ? loading : stepping || !canProceed;

  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-border/20 bg-surface-muted/95 px-4 py-4 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <div className="panel space-y-4">
        {activeQuote && !isConfirmStep && step !== 'review' && (
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-slate-900">Running estimate</p>
            <QuoteBreakdownPanel quote={activeQuote} totalLabel="Running total" />
          </div>
        )}

        {isConfirmStep && activeQuote && (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-primary/5 px-4 py-3 text-sm ring-1 ring-primary/10">
            <span className="text-muted">Due at checkout</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(activeQuote.total)}</span>
          </div>
        )}

        <div className="btn-row sm:justify-end">
          {isFirstStep ? (
            <ButtonLink href="/dashboard" variant="ghost" size="lg" className="w-full sm:w-auto sm:min-w-[132px]">
              Cancel
            </ButtonLink>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onBack}
              disabled={loading || stepping}
              className="w-full sm:w-auto sm:min-w-[132px]"
            >
              Back
            </Button>
          )}

          {isConfirmStep ? (
            <Button
              type="button"
              size="lg"
              disabled={primaryDisabled}
              onClick={onConfirm}
              className="w-full min-w-0 flex-1 sm:max-w-md"
            >
              {loading ? 'Creating order…' : 'Continue to checkout'}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              disabled={primaryDisabled}
              onClick={onNext}
              className="w-full min-w-0 flex-1 sm:max-w-md"
            >
              {stepping ? 'Saving…' : getNextStepLabel(step)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BookingWizard() {
  const { api } = useAuthContext();
  const router = useRouter();
  const [step, setStep] = useState<BookingStep>('service');
  const [form, setForm] = useState<BookingFormState>(initialBookingForm);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [areaLabel, setAreaLabel] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [availableServices, setAvailableServices] = useState<BookingType[]>([]);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [nearestBranches, setNearestBranches] = useState<NearestBranchRow[]>([]);
  const [nearestNote, setNearestNote] = useState('');
  const [partnerCoverage, setPartnerCoverage] = useState<PartnerCoverageInfo | null>(null);
  const [coverageAddressId, setCoverageAddressId] = useState('');
  const selectedAddressIdRef = useRef(form.addressId);
  const [showBranchHints, setShowBranchHints] = useState(
    () => loadCustomerSettings().showBranchDistanceHints,
  );

  useEffect(() => {
    const sync = () => setShowBranchHints(loadCustomerSettings().showBranchDistanceHints);
    sync();
    window.addEventListener('lunara-customer-settings', sync);
    return () => window.removeEventListener('lunara-customer-settings', sync);
  }, []);

  useEffect(() => {
    setConfigLoading(true);
    api
      .get<BookingConfig>('/booking/config')
      .then((res) => setConfig(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load booking options'),
      )
      .finally(() => setConfigLoading(false));

    api
      .get<AddressOption[]>('/addresses')
      .then((res) => setAddresses(res.data))
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    selectedAddressIdRef.current = form.addressId;
  }, [form.addressId]);

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
      if (!addressId) return;
      setPartnerCoverage(null);
      setCoverageAddressId('');
      setNearestBranches([]);
      setNearestNote('');
      const res = await api.get<{
        areaLabel: string;
        availableServices: BookingType[];
        slots: PickupSlot[];
        dispatchNote?: string;
        partnerCoverage?: PartnerCoverageInfo;
      }>(`/booking/availability?addressId=${encodeURIComponent(addressId)}`);

      if (selectedAddressIdRef.current !== addressId) return;

      setAreaLabel(res.data.areaLabel);
      setAvailableServices(res.data.availableServices);
      setSlots(res.data.slots);
      setDispatchNote(res.data.dispatchNote ?? '');
      setPartnerCoverage(res.data.partnerCoverage ?? null);
      setCoverageAddressId(addressId);
      const firstAvailable = res.data.slots.find((s) => s.available);
      if (firstAvailable) {
        setForm((f) =>
          f.addressId !== addressId
            ? f
            : f.scheduledPickupAt
              ? f
              : { ...f, scheduledPickupAt: firstAvailable.startAt },
        );
      }
    },
    [api],
  );

  const coverageMatchesSelection =
    Boolean(form.addressId) && coverageAddressId === form.addressId;
  const activePartnerCoverage = coverageMatchesSelection ? partnerCoverage : null;
  const hasRealPartnerCoverage =
    activePartnerCoverage?.inServiceArea === true &&
    activePartnerCoverage?.hasPartnerNearby === true;

  const loadNearestBranches = useCallback(
    async (addressId: string) => {
      if (!showBranchHints) {
        setNearestBranches([]);
        setNearestNote('');
        return;
      }
      try {
        const res = await api.get<{ ranked: NearestBranchRow[]; note?: string }>(
          `/branches/nearest?addressId=${encodeURIComponent(addressId)}`,
        );
        if (selectedAddressIdRef.current !== addressId) return;

        const inRange = (res.data.ranked ?? []).filter(
          (b) => b.withinRadius && b.capacityAvailable,
        );
        setNearestBranches(inRange);
        setNearestNote(res.data.note ?? '');
      } catch {
        if (selectedAddressIdRef.current === addressId) {
          setNearestBranches([]);
          setNearestNote('');
        }
      }
    },
    [api, showBranchHints],
  );

  useEffect(() => {
    if (!form.addressId) {
      setPartnerCoverage(null);
      setCoverageAddressId('');
      setAreaLabel('');
      setAvailableServices([]);
      setSlots([]);
      setDispatchNote('');
      setNearestBranches([]);
      setNearestNote('');
      return;
    }
    setError('');
    const addressForError = addresses.find((a) => a._id === form.addressId);
    loadAvailability(form.addressId).catch((err) => {
      if (selectedAddressIdRef.current !== form.addressId) return;
      setError(formatAvailabilityLoadError(err, addressForError));
      setPartnerCoverage(null);
      setCoverageAddressId('');
    });
  }, [form.addressId, loadAvailability, addresses]);

  useEffect(() => {
    if (!form.addressId || !hasRealPartnerCoverage) {
      setNearestBranches([]);
      setNearestNote('');
      return;
    }
    void loadNearestBranches(form.addressId);
  }, [form.addressId, hasRealPartnerCoverage, loadNearestBranches]);

  async function refreshServerQuote() {
    if (!form.bookingType || !form.addressId) return null;
    const res = await api.post<QuoteBreakdown>(
      `/booking/quote?addressId=${encodeURIComponent(form.addressId)}`,
      {
        bookingType: form.bookingType,
        weightKg: form.weightKg,
        addonIds: form.addonIds,
      },
    );
    setQuote(res.data);
    return res.data;
  }

  async function goNext() {
    setError('');
    if (!canProceedStep(step, form, localQuote, addresses, slots)) {
      if (step === 'service') setError('Select a service');
      else if (step === 'address') setError('Select a pickup address');
      else if (step === 'schedule') setError('Select a pickup time');
      else if (step === 'weight') {
        setError(
          `Minimum order is ${formatCurrency(BOOKING_MIN_ORDER_AMOUNT)}. Increase weight or add add-ons.`,
        );
      }
      return;
    }

    setStepping(true);
    try {
      if (step === 'address') {
        try {
          await loadAvailability(form.addressId);
        } catch (err) {
          setError(
            formatAvailabilityLoadError(
              err,
              addresses.find((a) => a._id === form.addressId),
            ),
          );
          return;
        }
      }
      if (step === 'review') {
        try {
          await refreshServerQuote();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not calculate price');
          return;
        }
      }
      const n = nextStep(step);
      if (n) setStep(n);
    } finally {
      setStepping(false);
    }
  }

  function goBack() {
    setError('');
    const p = prevStep(step);
    if (p) setStep(p);
  }

  async function createOrder() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ _id: string; total: number }>('/booking/orders', {
        bookingType: form.bookingType,
        weightKg: form.weightKg,
        addonIds: form.addonIds,
        pickupAddressId: form.addressId,
        scheduledPickupAt: form.scheduledPickupAt,
      });
      router.push(`/checkout/${res.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  const services = config?.services ?? [];
  const addons = config?.addons ?? [];
  const activeQuote = quote ?? localQuote;
  const selectedAddress = addresses.find((a) => a._id === form.addressId);
  const selectedSlot = slots.find((s) => s.startAt === form.scheduledPickupAt);
  const canProceed = canProceedStep(step, form, localQuote, addresses, slots);

  if (configLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        Loading booking options…
      </div>
    );
  }

  return (
    <div className="pb-28 sm:pb-0">
      <BookingProgress current={step} />

      {step === 'service' && (
        <section>
          <StepHeader
            title="Select service"
            description="Choose the type of laundry service you need. Pricing is per kilogram."
          />
          <div className="list-stack">
            {services.map((s) => {
              const areaOk =
                availableServices.length === 0 || availableServices.includes(s.type);
              const disabled = Boolean(form.addressId && !areaOk);
              return (
                <SelectableOption
                  key={s.type}
                  selected={form.bookingType === s.type}
                  disabled={disabled}
                  onClick={() => setForm((f) => ({ ...f, bookingType: s.type }))}
                >
                  <p className="font-medium text-slate-900">{s.label}</p>
                  <p className="mt-1 text-sm text-muted">{s.description}</p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {formatCurrency(s.pricePerKg)} / kg · min {s.minWeightKg} kg
                  </p>
                  {disabled && (
                    <p className="mt-2 text-xs text-amber-700">Not available in your area</p>
                  )}
                </SelectableOption>
              );
            })}
          </div>
        </section>
      )}

      {step === 'address' && (
        <section>
          <StepHeader
            title="Pickup address"
            description="Service availability depends on your area. After payment, Lunara assigns your laundry partner."
          />
          {form.addressId && coverageMatchesSelection && dispatchNote && (
            <div className="mb-4 rounded-lg bg-primary/5 p-4 text-sm text-slate-700 ring-1 ring-primary/15">
              {dispatchNote}
            </div>
          )}
          {addresses.length === 0 ? (
            <div className="panel text-sm text-muted">
              No addresses saved.{' '}
              <Link href="/onboarding/address" className="link-primary">
                Add an address
              </Link>
            </div>
          ) : (
            <div className="list-stack">
              {addresses.map((a) => (
                <SelectableOption
                  key={a._id}
                  selected={form.addressId === a._id}
                  onClick={() =>
                    setForm((f) => ({ ...f, addressId: a._id, scheduledPickupAt: '' }))
                  }
                >
                  <p className="font-medium text-slate-900">{a.label}</p>
                  <p className="mt-1 text-sm text-muted">
                    {a.line1}, {a.city}, {a.province} {a.postalCode}
                  </p>
                </SelectableOption>
              ))}
            </div>
          )}
          {form.addressId && !coverageMatchesSelection && (
            <p className="mt-4 text-sm text-muted">Checking partner coverage for this address…</p>
          )}
          {form.addressId && activePartnerCoverage && (
            <OrderPartnerCoverageNotice
              coverage={activePartnerCoverage}
              className="mt-4"
            />
          )}
          {form.addressId &&
            showBranchHints &&
            coverageMatchesSelection &&
            hasRealPartnerCoverage &&
            nearestBranches.length > 0 && (
              <NearestBranchesCard branches={nearestBranches} note={nearestNote} />
            )}
        </section>
      )}

      {step === 'schedule' && (
        <section>
          <StepHeader
            title="Pickup schedule"
            description={
              areaLabel ? `Serving ${areaLabel}. Pick a convenient pickup window.` : undefined
            }
          />
          {slots.length === 0 ? (
            <>
              <div className="panel text-sm text-muted">
                No slots available. Try another day or address.
              </div>
              <ScheduleSupportPrompt
                address={selectedAddress ?? null}
                reason="No pickup slots are available for this address yet."
              />
            </>
          ) : (
            <PickupSchedulePicker
              slots={slots}
              selectedStartAt={form.scheduledPickupAt}
              onSelectStartAt={(startAt) =>
                setForm((f) => ({ ...f, scheduledPickupAt: startAt }))
              }
            />
          )}
        </section>
      )}

      {step === 'weight' && (
        <section>
          <StepHeader
            title="Estimate weight"
            description={`We'll confirm actual weight at pickup. Minimum order ${formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.`}
          />
          <div className="panel">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted">Estimated load</p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-primary">
                  {form.weightKg} kg
                </p>
              </div>
              {activeQuote && (
                <div className="text-right">
                  <p className="text-xs text-muted">Service subtotal</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatCurrency(activeQuote.serviceSubtotal)}
                  </p>
                </div>
              )}
            </div>
            <input
              type="range"
              min={config?.minWeightKg ?? 1}
              max={config?.maxWeightKg ?? 50}
              value={form.weightKg}
              onChange={(e) => setForm((f) => ({ ...f, weightKg: Number(e.target.value) }))}
              className="mt-6 w-full accent-primary"
              aria-label="Estimated weight in kilograms"
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{config?.minWeightKg ?? 1} kg</span>
              <span>{config?.maxWeightKg ?? 50} kg</span>
            </div>
            {localQuote && !localQuote.meetsMinimum && (
              <p className="mt-4 text-sm text-red-600">
                Below minimum order of {formatCurrency(localQuote.minimumOrderAmount)}.
              </p>
            )}
          </div>
        </section>
      )}

      {step === 'addons' && (
        <section>
          <StepHeader
            title="Add-ons"
            description="Optional extras to enhance your laundry service."
          />
          {addons.length === 0 ? (
            <div className="panel text-sm text-muted">No add-ons available right now.</div>
          ) : (
            <div className="list-stack">
              {addons.map((a) => {
                const selected = form.addonIds.includes(a.id);
                return (
                  <SelectableOption
                    key={a.id}
                    selected={selected}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        addonIds: selected
                          ? f.addonIds.filter((id) => id !== a.id)
                          : [...f.addonIds, a.id],
                      }))
                    }
                  >
                    <div className="flex justify-between gap-4">
                      <span className="font-medium text-slate-900">{a.label}</span>
                      <span className="shrink-0 font-medium text-primary">
                        +{formatCurrency(a.price)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{a.description}</p>
                  </SelectableOption>
                );
              })}
            </div>
          )}
        </section>
      )}

      {step === 'review' && activeQuote && (
        <section>
          <StepHeader
            title="Price estimate"
            description="Review your estimated total before confirming."
          />
          <div className="panel">
            <QuoteBreakdownPanel quote={activeQuote} />
          </div>
        </section>
      )}

      {step === 'confirm' && activeQuote && (
        <section>
          <StepHeader
            title="Confirm booking"
            description="Double-check your details, then continue to checkout."
          />
          <div className="panel">
            <dl className="space-y-3 text-sm">
              <SummaryRow label="Service" value={activeQuote.serviceLabel} />
              <SummaryRow label="Address" value={selectedAddress?.label ?? 'Selected address'} />
              <SummaryRow
                label="Pickup"
                value={selectedSlot?.label ?? 'Selected slot'}
              />
              <SummaryRow label="Weight" value={`~${activeQuote.weightKg} kg`} />
              {activeQuote.addons.length > 0 && (
                <SummaryRow
                  label="Add-ons"
                  value={activeQuote.addons.map((a) => a.label).join(', ')}
                />
              )}
              <div className="border-t border-border/30 pt-3">
                <SummaryRow
                  label="Estimated total"
                  value={formatCurrency(activeQuote.total)}
                  emphasis
                />
              </div>
            </dl>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Lunara operations assigns your partner branch after payment. Pickup riders are notified
            once dispatched. Final amount may adjust after weigh-in.
          </p>
        </section>
      )}

      {error && <WizardError message={error} />}

      <WizardActions
        step={step}
        loading={loading}
        stepping={stepping}
        activeQuote={activeQuote}
        canProceed={canProceed}
        onBack={goBack}
        onNext={goNext}
        onConfirm={createOrder}
      />
    </div>
  );
}
