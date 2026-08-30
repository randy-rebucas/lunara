import { Button } from '@lunara/ui';
import {
  type BagSizeId,
  type BagSizeOption,
  formatCurrency,
  formatMachineLoadLabel,
  type MultiServiceQuoteBreakdown,
  recommendBagForWeight,
  resolveMediaUrl,
} from '@lunara/utils';
import { ButtonLink } from '../ui/button-link';
import { buttonResponsiveClass } from '../ui/button-layout';
import { BOOKING_STEPS, type BookingStep } from '../../lib/booking-flow';
import { QuoteBreakdownPanel } from './quote-breakdown';

export function AddonImage({ imageUrl }: { imageUrl?: string }) {
  const src = resolveMediaUrl(imageUrl, process.env.NEXT_PUBLIC_API_URL);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 object-cover ring-1 ring-border/40"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 ring-1 ring-border/40">
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="1.75" fill="currentColor" />
        <path
          d="M3 16l5-5 4 4 3-3 6 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function BookingProgress({ current }: { current: BookingStep }) {
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

export function StepHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
    </header>
  );
}

export function WizardError({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200/80">
      {message}
    </div>
  );
}

export function SelectableOption({
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

export function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${emphasis ? 'text-base font-bold' : 'text-sm'}`}>
      <dt className={emphasis ? 'text-slate-900' : 'text-muted'}>{label}</dt>
      <dd className={emphasis ? 'text-primary' : 'text-slate-900'}>{value}</dd>
    </div>
  );
}

/** Simple drawn laundry-bag icon — no photo assets exist for bag sizes, so the visual scales
 * purely from the tier index (0 = smallest … 3 = largest) via the wrapping box's pixel size. */
export function BagIcon({ sizePx }: { sizePx: number }) {
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

export const BAG_ICON_SIZES = [56, 72, 88, 104];

export function BagWeightSlider({
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
export function WeightSlider({
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

export function BagPreviewCard({
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

/** Live "here's roughly what bag that fills" readout for the PER_KG/PER_LOAD weight steps —
 * informational only, those modes bill by kg/load rather than by bag. */
export function BagFitHint({ weightKg, bagSizes }: { weightKg: number; bagSizes: BagSizeOption[] }) {
  const bag = recommendBagForWeight(weightKg, bagSizes);
  if (!bag) return null;
  return (
    <p className="mt-2 text-sm text-muted">
      That&apos;s roughly a <span className="font-medium text-slate-900">{bag.label} bag</span> (up to{' '}
      {bag.capacityKg} kg).
    </p>
  );
}

export function WizardActions({
  step,
  loading,
  stepping,
  activeQuote,
  canProceed,
  onBack,
  onNext,
  onConfirm,
  getNextStepLabel,
}: {
  step: BookingStep;
  loading: boolean;
  stepping: boolean;
  activeQuote: MultiServiceQuoteBreakdown | null;
  canProceed: boolean;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
  getNextStepLabel: (step: BookingStep) => string;
}) {
  const isFirstStep = step === BOOKING_STEPS[0].id;
  const isConfirmStep = step === 'confirm';
  const primaryDisabled = isConfirmStep ? loading : stepping || !canProceed;

  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-8 border-t border-border/20 bg-surface-muted/95 px-4 py-4 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
      <div className="panel space-y-4">
        {activeQuote && !isConfirmStep && step !== 'review' && (
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-slate-900">Running estimate</p>
            <QuoteBreakdownPanel
              quote={activeQuote}
              totalLabel="Running total"
              showDeliveryFee={step !== 'weight' && step !== 'addons'}
            />
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
