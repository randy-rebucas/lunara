'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookingType } from '@lunara/types';
import { Button } from '@lunara/ui';
import { ButtonLink } from '../ui/button-link';
import { buttonResponsiveClass } from '../ui/button-layout';
import {
  BOOKING_MACHINE_LOAD_INFO,
  BOOKING_MIN_ORDER_AMOUNT,
  BranchPricingMode,
  estimateMachineLoads,
  formatMachineLoadLabel,
  calculateQuote,
  formatCurrency,
  getTodayScheduleSummary,
  type BagSizeId,
  type BagSizeOption,
  type BookingAddonOption,
  type BranchHoliday,
  type LaundryServiceOption,
  type PartnerCoverageInfo,
  isPickupSlotBookable,
  type PickupSlot,
  type QuoteBreakdown,
} from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
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
import { PromoCodeField } from './promo-code-field';
import { QuoteBreakdownPanel } from './quote-breakdown';

interface BookingWizardProps {
  initialCouponCode?: string;
  reorderOrderId?: string;
}

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
  line1: string;
  city: string;
  province: string;
  postalCode: string;
}

interface BookingConfig {
  services: LaundryServiceOption[];
  addons: BookingAddonOption[];
  minOrderAmount: number;
  bagSizes: BagSizeOption[];
  deliveryFee: number;
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

interface ShopOption {
  branchId: string;
  code: string;
  name: string;
  city: string;
  distanceKm: number;
  distanceLabel: string;
  withinRadius: boolean;
  capacityAvailable: boolean;
  pricingMode: BranchPricingMode;
  operatingHours: { isClosed: boolean; openTime: string; closeTime: string }[];
  holidays: BranchHoliday[];
  services: ShopServiceOption[];
  addons: ShopAddonOption[];
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

/** Simple drawn laundry-bag icon — no photo assets exist for bag sizes, so the visual scales
 * purely from the tier index (0 = smallest … 3 = largest) via the wrapping box's pixel size. */
function BagIcon({ sizePx }: { sizePx: number }) {
  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 64 64"
      fill="none"
      className="text-primary transition-all duration-300"
    >
      <path
        d="M18 24 L20 12 a12 12 0 0 1 24 0 L46 24"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 24 H50 L47 56 a4 4 0 0 1 -4 4 H21 a4 4 0 0 1 -4 -4 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />
    </svg>
  );
}

const BAG_ICON_SIZES = [56, 72, 88, 104];

function BagWeightSlider({
  bagSizes,
  enteredWeightKg,
  onChange,
}: {
  bagSizes: BagSizeOption[];
  enteredWeightKg: string;
  onChange: (raw: string, bagId: BagSizeId | undefined) => void;
}) {
  if (bagSizes.length === 0) return null;
  const maxKg = bagSizes[bagSizes.length - 1].capacityKg;
  const weight = Number(enteredWeightKg) || 0;

  function weightToBag(w: number): BagSizeOption | undefined {
    if (w <= 0) return undefined;
    return bagSizes.find((bag) => w <= bag.capacityKg) ?? bagSizes[bagSizes.length - 1];
  }

  return (
    <div className="panel">
      <label className="form-label" htmlFor="bag-weight-slider">
        Not sure? Drag to your estimated weight (kg)
      </label>
      <input
        id="bag-weight-slider"
        type="range"
        min={0}
        max={maxKg}
        step={0.5}
        className="mt-2 w-full accent-primary"
        value={weight}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw, weightToBag(Number(raw))?.id);
        }}
      />
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>0 kg</span>
        <span className="font-medium text-primary">{weight > 0 ? `${weight} kg` : 'Drag to estimate'}</span>
        <span>{maxKg} kg</span>
      </div>
    </div>
  );
}

/** Estimated-weight slider for the per-kg/per-load steps (no bag tiers involved — just a plain
 * weight readout). Caps the slider at `maxKg`, but the value can still be typed higher if a
 * customer's actual load exceeds it — dragging the handle to the end just means "at least maxKg". */
function WeightSlider({
  id,
  value,
  maxKg = 30,
  onChange,
}: {
  id: string;
  value: string;
  maxKg?: number;
  onChange: (raw: string) => void;
}) {
  const weight = Number(value) || 0;
  return (
    <div>
      <input
        id={id}
        type="range"
        min={0}
        max={maxKg}
        step={0.5}
        className="mt-2 w-full accent-primary"
        value={Math.min(weight, maxKg)}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>0 kg</span>
        <span className="font-medium text-primary">
          {weight > 0 ? `${weight} kg` : 'Drag to estimate'}
        </span>
        <span>{weight > maxKg ? `${weight} kg` : `${maxKg}+ kg`}</span>
      </div>
    </div>
  );
}

function BagPreviewCard({
  bagSizes,
  bagSizeId,
}: {
  bagSizes: BagSizeOption[];
  bagSizeId: BagSizeId | '';
}) {
  const index = bagSizes.findIndex((b) => b.id === bagSizeId);
  const bag = index >= 0 ? bagSizes[index] : undefined;
  const sizePx = BAG_ICON_SIZES[Math.max(index, 0)] ?? BAG_ICON_SIZES[0];

  return (
    <div className="panel flex flex-col items-center justify-center gap-3 py-8 text-center">
      <div className="flex h-28 w-28 items-center justify-center">
        <BagIcon sizePx={sizePx} />
      </div>
      {bag ? (
        <>
          <p className="text-lg font-semibold text-slate-900">{bag.label}</p>
          <p className="text-sm text-muted">
            Up to {bag.capacityKg} kg · {formatMachineLoadLabel(bag.capacityKg)}
          </p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(bag.price)}</p>
        </>
      ) : (
        <p className="text-sm text-muted">Pick a bag size or drag the slider to preview it here.</p>
      )}
    </div>
  );
}

function getNextStepLabel(step: BookingStep): string {
  switch (step) {
    case 'address':
      return 'Continue to shop selection';
    case 'shop':
      return 'Continue to service selection';
    case 'service':
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
    case 'shop':
      return Boolean(form.branchId) || form.autoDispatch;
    case 'schedule':
      return (
        Boolean(form.scheduledPickupAt) &&
        slots.some(
          (slot) => slot.startAt === form.scheduledPickupAt && isPickupSlotBookable(slot),
        )
      );
    case 'weight':
      return Boolean(localQuote);
    case 'addons':
      return Boolean(localQuote?.meetsMinimum);
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
  const isFirstStep = step === BOOKING_STEPS[0].id;
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
            <ButtonLink href="/dashboard" variant="ghost" size="lg" layout="responsive">
              Cancel
            </ButtonLink>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onBack}
              disabled={loading || stepping}
              className={buttonResponsiveClass('lg')}
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

export function BookingWizard({ initialCouponCode, reorderOrderId }: BookingWizardProps = {}) {
  const { api } = useAuthContext();
  const router = useRouter();
  const [step, setStep] = useState<BookingStep>('address');
  const [form, setForm] = useState<BookingFormState>(() => ({
    ...initialBookingForm,
    couponCode: initialCouponCode?.trim().toUpperCase() ?? '',
  }));
  const [showDistanceHints, setShowDistanceHints] = useState(
    () => loadCustomerSettings().showBranchDistanceHints,
  );

  useEffect(() => {
    const sync = () => setShowDistanceHints(loadCustomerSettings().showBranchDistanceHints);
    window.addEventListener('lunara-customer-settings', sync);
    return () => window.removeEventListener('lunara-customer-settings', sync);
  }, []);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [holidays, setHolidays] = useState<BranchHoliday[]>([]);
  const [areaLabel, setAreaLabel] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [availableServices, setAvailableServices] = useState<BookingType[]>([]);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const creatingOrderRef = useRef(false);
  const [stepping, setStepping] = useState(false);
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [favoriteBranchIds, setFavoriteBranchIds] = useState<Set<string>>(new Set());
  const [partnerCoverage, setPartnerCoverage] = useState<PartnerCoverageInfo | null>(null);
  const [coverageAddressId, setCoverageAddressId] = useState('');
  const [reorderNotice, setReorderNotice] = useState('');
  const [addressesError, setAddressesError] = useState('');
  const reorderAppliedRef = useRef(false);
  const pendingRebookBranchRef = useRef<string | null>(null);
  const selectedAddressIdRef = useRef(form.addressId);

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
      .catch((err) =>
        setAddressesError(
          err instanceof Error ? err.message : 'Could not load your saved addresses',
        ),
      );

    api
      .get<{ branchId: string }[]>('/favorites')
      .then((res) => setFavoriteBranchIds(new Set(res.data.map((f) => f.branchId))))
      .catch(() => {});
  }, [api]);

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
        await api.delete(`/favorites/${branchId}`);
      } else {
        await api.post('/favorites', { branchId });
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

  useEffect(() => {
    selectedAddressIdRef.current = form.addressId;
  }, [form.addressId]);

  // "Book again" from order history: prefill the same shop, service, bag size, and add-ons once
  // addresses have loaded (needed to check the order's old pickup address is still valid).
  useEffect(() => {
    if (!reorderOrderId || reorderAppliedRef.current || addresses.length === 0) return;
    reorderAppliedRef.current = true;
    api
      .get<ReorderSourceOrder>(`/orders/${reorderOrderId}`)
      .then((res) => {
        const order = res.data;
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
  }, [reorderOrderId, addresses, api]);

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

  const selectedShop = shopOptions.find((s) => s.branchId === form.branchId);
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
    config,
    selectedShop,
    selectedShopService,
    shopPricingMode,
  ]);

  const loadAvailability = useCallback(
    async (addressId: string) => {
      if (!addressId) return;
      setPartnerCoverage(null);
      setCoverageAddressId('');
      setShopOptions([]);
      const res = await api.get<{
        areaLabel: string;
        availableServices: BookingType[];
        slots: PickupSlot[];
        holidays?: BranchHoliday[];
        dispatchNote?: string;
        partnerCoverage?: PartnerCoverageInfo;
      }>(`/booking/availability?addressId=${encodeURIComponent(addressId)}`);

      if (selectedAddressIdRef.current !== addressId) return;

      setAreaLabel(res.data.areaLabel);
      setAvailableServices(res.data.availableServices);
      setSlots(res.data.slots);
      setHolidays(res.data.holidays ?? []);
      setDispatchNote(res.data.dispatchNote ?? '');
      setPartnerCoverage(res.data.partnerCoverage ?? null);
      setCoverageAddressId(addressId);
      const firstAvailable = res.data.slots.find((s) => isPickupSlotBookable(s));
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

  const loadShops = useCallback(
    async (addressId: string) => {
      setShopsLoading(true);
      try {
        const res = await api.get<ShopOption[]>(
          `/booking/shops?addressId=${encodeURIComponent(addressId)}`,
        );
        if (selectedAddressIdRef.current !== addressId) return;
        setShopOptions(res.data ?? []);
      } catch {
        if (selectedAddressIdRef.current === addressId) setShopOptions([]);
      } finally {
        if (selectedAddressIdRef.current === addressId) setShopsLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    if (!form.addressId) {
      setPartnerCoverage(null);
      setCoverageAddressId('');
      setAreaLabel('');
      setAvailableServices([]);
      setSlots([]);
      setDispatchNote('');
      setShopOptions([]);
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
      setShopOptions([]);
      return;
    }
    void loadShops(form.addressId);
  }, [form.addressId, hasRealPartnerCoverage, loadShops]);

  async function refreshServerQuote(couponCode = form.couponCode) {
    if (!form.bookingType || !form.addressId || (!form.branchId && !form.autoDispatch)) return null;
    const res = await api.post<QuoteBreakdown>(
      `/booking/quote?addressId=${encodeURIComponent(form.addressId)}`,
      {
        bookingType: form.bookingType,
        ...(form.branchId ? { branchId: form.branchId } : {}),
        ...(form.customServiceId ? { customServiceId: form.customServiceId } : {}),
        ...(form.bagSizeId ? { bagSizeId: form.bagSizeId } : {}),
        ...(Number(form.enteredWeightKg) ? { enteredWeightKg: Number(form.enteredWeightKg) } : {}),
        ...(Number(form.enteredLoadCount) ? { enteredLoadCount: Number(form.enteredLoadCount) } : {}),
        ...(Number(form.enteredPieceCount) ? { enteredPieceCount: Number(form.enteredPieceCount) } : {}),
        addonIds: form.addonIds,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      },
    );
    setQuote(res.data);
    return res.data;
  }

  async function applyPromoCode() {
    setPromoLoading(true);
    setError('');
    try {
      await refreshServerQuote(form.couponCode);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : 'Could not apply promo code');
    } finally {
      setPromoLoading(false);
    }
  }

  async function removePromoCode() {
    setForm((f) => ({ ...f, couponCode: '' }));
    setPromoLoading(true);
    setError('');
    try {
      await refreshServerQuote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh price');
    } finally {
      setPromoLoading(false);
    }
  }

  async function goNext() {
    setError('');
    if (!canProceedStep(step, form, localQuote, addresses, slots)) {
      if (step === 'service') setError('Select a service');
      else if (step === 'address') setError('Select a pickup address');
      else if (step === 'schedule') setError('Select a pickup time');
      else if (step === 'weight') {
        setError(
          `Minimum order is ${formatCurrency(BOOKING_MIN_ORDER_AMOUNT)}. Choose a bag size to continue.`,
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
    if (creatingOrderRef.current) return;
    creatingOrderRef.current = true;
    setLoading(true);
    setError('');
    try {
      await refreshServerQuote(form.couponCode);
      const res = await api.post<{ _id: string; total: number }>('/booking/orders', {
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
      });
      router.push(`/checkout/${res.data._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
      creatingOrderRef.current = false;
    } finally {
      setLoading(false);
    }
  }

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

      {step === 'address' && (
        <section>
          <StepHeader
            title="Pickup address"
            description="Service availability depends on your area. Next, you'll choose which laundry shop to book."
          />
          {form.addressId && coverageMatchesSelection && dispatchNote && (
            <div className="mb-4 rounded-lg bg-primary/5 p-4 text-sm text-slate-700 ring-1 ring-primary/15">
              {dispatchNote}
            </div>
          )}
          {addressesError ? (
            <div className="panel text-sm text-red-600">{addressesError}</div>
          ) : addresses.length === 0 ? (
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
                  onClick={() => {
                    setReorderNotice('');
                    setForm((f) => ({
                      ...f,
                      addressId: a._id,
                      branchId: '',
                      autoDispatch: false,
                      scheduledPickupAt: '',
                    }));
                  }}
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
        </section>
      )}

      {step === 'shop' && (
        <section>
          <StepHeader
            title="Choose a laundry shop"
            description="Pick the partner shop you'd like to book with. Prices shown are what you'll pay."
          />
          {reorderNotice && <p className="mb-4 text-xs text-amber-700">{reorderNotice}</p>}
          {!shopsLoading && shopOptions.length > 0 && (
            <div className="list-stack mb-4">
              <SelectableOption
                selected={form.autoDispatch}
                onClick={() => {
                  setReorderNotice('');
                  setForm((f) => ({ ...f, autoDispatch: true, branchId: '' }));
                }}
              >
                <p className="font-medium text-slate-900">Let Lunara pick a shop for you</p>
                <p className="mt-1 text-sm text-muted">
                  We&apos;ll dispatch to the best available shop nearby — useful when your usual
                  shops are full.
                </p>
              </SelectableOption>
            </div>
          )}
          {shopsLoading ? (
            <div className="panel text-sm text-muted">Finding nearby shops…</div>
          ) : shopOptions.length === 0 ? (
            <div className="panel text-sm text-muted">
              No partner shops are available near this address yet.
            </div>
          ) : (
            <div className="list-stack">
              {shopOptions.map((shop) => {
                // Services on the same shop can each bill in a different unit now, so "cheapest"
                // is computed per-service in its own unit rather than assuming one shop-wide unit.
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
                const disabled = !shop.withinRadius || !shop.capacityAvailable;
                const schedule = getTodayScheduleSummary(shop.operatingHours, shop.holidays);
                const isFavorite = favoriteBranchIds.has(shop.branchId);
                return (
                  <div key={shop.branchId} className="relative">
                    <SelectableOption
                      selected={!form.autoDispatch && form.branchId === shop.branchId}
                      disabled={disabled}
                      onClick={() => {
                        setReorderNotice('');
                        setForm((f) => ({ ...f, branchId: shop.branchId, autoDispatch: false }));
                      }}
                    >
                      <p className="pr-6 font-medium text-slate-900">{shop.name}</p>
                      <p className="mt-1 text-sm text-muted">
                        {shop.city}
                        {showDistanceHints ? ` · ${shop.distanceLabel}` : ''}
                      </p>
                      <p className={`mt-1 text-xs font-medium ${schedule.isOpenNow ? 'text-accent' : 'text-muted'}`}>
                        {schedule.label}
                      </p>
                      {startingPriceLabel && (
                        <p className="mt-2 text-sm font-medium text-primary">{startingPriceLabel}</p>
                      )}
                      {!shop.capacityAvailable && (
                        <p className="mt-2 text-xs text-amber-700">Currently at capacity</p>
                      )}
                      {!shop.withinRadius && (
                        <p className="mt-2 text-xs text-amber-700">Outside delivery range</p>
                      )}
                    </SelectableOption>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteBranch(shop.branchId);
                      }}
                      aria-label={isFavorite ? `Remove ${shop.name} from favorites` : `Add ${shop.name} to favorites`}
                      className="absolute right-3 top-3 text-lg leading-none"
                    >
                      {isFavorite ? (
                        <span className="text-red-500">♥</span>
                      ) : (
                        <span className="text-slate-300 hover:text-slate-400">♡</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {step === 'service' && (
        <section>
          <StepHeader
            title="Select service"
            description={
              selectedShop
                ? `Prices below are what ${selectedShop.name} charges.`
                : 'Choose the type of laundry service you need.'
            }
          />
          <div className="list-stack">
            {services.map((s) => {
              const areaOk =
                availableServices.length === 0 || availableServices.includes(s.type);
              const disabled = Boolean(form.addressId && !areaOk);
              const selected = s.isCustom
                ? form.customServiceId === s.customServiceId
                : form.bookingType === s.type && !form.customServiceId;
              return (
                <SelectableOption
                  key={s.customServiceId ?? s.type}
                  selected={selected}
                  disabled={disabled}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      bookingType: s.type,
                      customServiceId: s.customServiceId ?? '',
                    }))
                  }
                >
                  <p className="font-medium text-slate-900">
                    {s.label}
                    {s.isCustom && <span className="badge-accent ml-2 text-xs">Shop special</span>}
                  </p>
                  <p className="mt-1 text-sm text-muted">{s.description}</p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {s.pricingUnit === BranchPricingMode.PER_LOAD && s.basePricePerLoad != null
                      ? `${formatCurrency(s.basePricePerLoad)} / load`
                      : s.pricingUnit === BranchPricingMode.PER_PIECE && s.basePricePerPiece != null
                        ? `${formatCurrency(s.basePricePerPiece)} / piece`
                        : s.pricingUnit === BranchPricingMode.FLAT_BAG
                          ? 'Priced by bag size'
                          : `${formatCurrency(s.pricePerKg)} / kg · min ${s.minWeightKg} kg`}
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
              holidays={holidays}
            />
          )}
        </section>
      )}

      {step === 'weight' && shopPricingMode === BranchPricingMode.FLAT_BAG && (
        <section>
          <StepHeader
            title="Choose a bag size"
            description="Same flat price everywhere — drag the slider to your estimated weight and we'll pick the bag that fits. We'll confirm actual weight at pickup."
          />
          <div className="grid gap-6 sm:grid-cols-[1.3fr_1fr]">
            <div>
              <BagWeightSlider
                bagSizes={config?.bagSizes ?? []}
                enteredWeightKg={form.enteredWeightKg}
                onChange={(raw, bagId) =>
                  setForm((f) => ({ ...f, enteredWeightKg: raw, bagSizeId: bagId ?? f.bagSizeId }))
                }
              />
              <div className="list-stack mt-4">
                {(config?.bagSizes ?? []).map((bag) => {
                  const selected = form.bagSizeId === bag.id;
                  return (
                    <button
                      key={bag.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, bagSizeId: bag.id }))}
                      className={`panel w-full text-left transition-colors ${
                        selected ? 'ring-2 ring-primary' : 'hover:bg-slate-50'
                      }`}
                      aria-pressed={selected}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {bag.label}
                            {selected && form.enteredWeightKg && (
                              <span className="badge-accent ml-2 text-xs">Recommended</span>
                            )}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            Up to {bag.capacityKg} kg · {formatMachineLoadLabel(bag.capacityKg)}
                          </p>
                        </div>
                        <p className="text-xl font-bold text-primary">{formatCurrency(bag.price)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <BagPreviewCard bagSizes={config?.bagSizes ?? []} bagSizeId={form.bagSizeId} />
          </div>
        </section>
      )}

      {step === 'weight' && shopPricingMode === BranchPricingMode.PER_KG && (
        <section>
          <StepHeader
            title="Estimate your weight"
            description="This shop charges per kilo. Enter an estimate now — we'll confirm the actual weight and final price at pickup."
          />
          <div className="panel">
            <label className="form-label" htmlFor="entered-weight">
              Estimated weight (kg)
            </label>
            <WeightSlider
              id="entered-weight"
              value={form.enteredWeightKg}
              onChange={(raw) => setForm((f) => ({ ...f, enteredWeightKg: raw }))}
            />
            {localQuote && (
              <p className="mt-3 text-sm font-medium text-primary">
                Estimated: {formatCurrency(localQuote.serviceSubtotal)}
              </p>
            )}
          </div>
        </section>
      )}

      {step === 'weight' && shopPricingMode === BranchPricingMode.PER_LOAD && (
        <section>
          <StepHeader
            title="Estimate your load count"
            description={`This shop charges per machine load. Enter your estimated weight (or load count directly) — we'll confirm the actual load count and final price at pickup. ${BOOKING_MACHINE_LOAD_INFO}`}
          />
          <div className="panel">
            <label className="form-label" htmlFor="entered-weight-load">
              Estimated weight (kg)
            </label>
            <WeightSlider
              id="entered-weight-load"
              value={form.enteredWeightKg}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  enteredWeightKg: v,
                  enteredLoadCount: v ? String(estimateMachineLoads(Number(v) || 0)) : '',
                }))
              }
            />
            <p className="mt-2 text-sm text-muted">
              {form.enteredLoadCount
                ? `${form.enteredLoadCount} machine load${Number(form.enteredLoadCount) === 1 ? '' : 's'}`
                : 'kg'}
            </p>
            {localQuote && (
              <p className="mt-3 text-sm font-medium text-primary">
                Estimated: {formatCurrency(localQuote.serviceSubtotal)}
              </p>
            )}
          </div>
        </section>
      )}

      {step === 'weight' && shopPricingMode === BranchPricingMode.PER_PIECE && (
        <section>
          <StepHeader
            title="Estimate your piece count"
            description="This shop charges per piece. Enter an estimated piece count now — we'll confirm the actual count and final price at pickup."
          />
          <div className="panel">
            <label className="form-label" htmlFor="entered-pieces">
              Estimated pieces
            </label>
            <input
              id="entered-pieces"
              type="number"
              min={0}
              step="1"
              className="input-field w-40"
              value={form.enteredPieceCount}
              onChange={(e) => setForm((f) => ({ ...f, enteredPieceCount: e.target.value }))}
            />
            {localQuote && (
              <p className="mt-3 text-sm font-medium text-primary">
                Estimated: {formatCurrency(localQuote.serviceSubtotal)}
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
          {localQuote && !localQuote.meetsMinimum && (
            <p className="mb-3 text-sm text-red-600">
              Below minimum order of {formatCurrency(localQuote.minimumOrderAmount)}. Add an
              add-on to continue.
            </p>
          )}
          {addons.length === 0 ? (
            <div className="panel text-sm text-muted">No add-ons available right now.</div>
          ) : (
            <div className="list-stack">
              {addons.map((a) => {
                const selected = form.addonIds.includes(a.id);
                const unitSuffix =
                  a.pricingUnit === BranchPricingMode.PER_KG
                    ? ' / kg'
                    : a.pricingUnit === BranchPricingMode.PER_LOAD
                      ? ' / load'
                      : a.pricingUnit === BranchPricingMode.PER_PIECE
                        ? ' / piece'
                        : '';
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
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-4">
                        <span className="font-medium text-slate-900">
                          {a.label}
                          {a.isCustom && (
                            <span className="badge-accent ml-2 text-xs">Shop special</span>
                          )}
                        </span>
                        <span className="shrink-0 font-medium text-primary">
                          +{formatCurrency(a.price)}
                          {unitSuffix}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">{a.description}</p>
                    </div>
                  </SelectableOption>
                );
              })}
            </div>
          )}
          {shopPricingMode !== BranchPricingMode.PER_PIECE &&
            form.addonIds.some(
              (id) => addons.find((a) => a.id === id)?.pricingUnit === BranchPricingMode.PER_PIECE,
            ) && (
              <div className="panel mt-3">
                <label className="form-label" htmlFor="addon-piece-count">
                  Piece count{' '}
                  <span className="font-normal text-muted">(for the per-piece add-on above)</span>
                </label>
                <input
                  id="addon-piece-count"
                  type="number"
                  min={0}
                  className="input-field mt-1 w-32"
                  value={form.enteredPieceCount}
                  onChange={(e) => setForm((f) => ({ ...f, enteredPieceCount: e.target.value }))}
                />
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
          <div className="panel space-y-6">
            <PromoCodeField
              value={form.couponCode}
              appliedCode={activeQuote.couponCode}
              appliedTitle={activeQuote.promotionTitle}
              loading={promoLoading}
              onValueChange={(couponCode) => setForm((f) => ({ ...f, couponCode }))}
              onApply={applyPromoCode}
              onRemove={removePromoCode}
            />
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
              <SummaryRow
                label="Shop"
                value={form.autoDispatch ? "Lunara's pick (best available)" : selectedShop?.name ?? 'Selected shop'}
              />
              <SummaryRow label="Address" value={selectedAddress?.label ?? 'Selected address'} />
              <SummaryRow
                label="Pickup"
                value={selectedSlot?.label ?? 'Selected slot'}
              />
              <SummaryRow
                label={
                  activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
                    ? 'Bag size'
                    : activeQuote.pricingMode === BranchPricingMode.PER_PIECE
                      ? 'Estimated pieces'
                      : 'Estimated weight'
                }
                value={
                  activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
                    ? `${activeQuote.bagLabel} (up to ${activeQuote.weightKg} kg)`
                    : activeQuote.pricingMode === BranchPricingMode.PER_PIECE
                      ? `${activeQuote.pieceCount ?? form.enteredPieceCount} pieces`
                      : `${activeQuote.weightKg} kg`
                }
              />
              {activeQuote.addons.length > 0 && (
                <SummaryRow
                  label="Add-ons"
                  value={activeQuote.addons.map((a) => a.label).join(', ')}
                />
              )}
              {activeQuote.couponCode && (
                <SummaryRow
                  label="Promo"
                  value={`${activeQuote.couponCode}${activeQuote.discount > 0 ? ` (−${formatCurrency(activeQuote.discount)})` : ''}`}
                />
              )}
              <div className="border-t border-border/30 pt-3">
                <SummaryRow
                  label={activeQuote.isEstimate ? 'Estimated total' : 'Total'}
                  value={formatCurrency(activeQuote.total)}
                  emphasis
                />
              </div>
            </dl>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {form.autoDispatch
              ? 'After payment, Lunara dispatches your order to the best available shop nearby.'
              : `Your order goes straight to ${selectedShop?.name ?? 'your selected shop'} after payment.`}{' '}
            Pickup riders are notified once dispatched.
            {activeQuote.isEstimate
              ? ' Final amount may adjust once the shop confirms the actual weight/load/piece count.'
              : ''}
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
