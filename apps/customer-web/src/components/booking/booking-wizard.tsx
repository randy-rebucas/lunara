'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookingType } from '@lunara/types';
import { Button } from '@lunara/ui';
import {
  BOOKING_MIN_ORDER_AMOUNT,
  calculateQuote,
  formatCurrency,
  type BookingAddonOption,
  type LaundryServiceOption,
  type PickupSlot,
  type QuoteBreakdown,
} from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import {
  BOOKING_STEPS,
  initialBookingForm,
  nextStep,
  prevStep,
  type BookingFormState,
  type BookingStep,
} from '../../lib/booking-flow';

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

export function BookingWizard() {
  const { api } = useAuthContext();
  const router = useRouter();
  const [step, setStep] = useState<BookingStep>('service');
  const [form, setForm] = useState<BookingFormState>(initialBookingForm);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [areaLabel, setAreaLabel] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [availableServices, setAvailableServices] = useState<BookingType[]>([]);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<BookingConfig>('/booking/config')
      .then((res) => setConfig(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load booking options'),
      );
    api
      .get<AddressOption[]>('/addresses')
      .then((res) => {
        setAddresses(res.data);
        if (res.data[0] && !form.addressId) {
          setForm((f) => ({ ...f, addressId: res.data[0]._id }));
        }
      })
      .catch(() => {});
  }, [api, form.addressId]);

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
      const res = await api.get<{
        areaLabel: string;
        availableServices: BookingType[];
        slots: PickupSlot[];
        dispatchNote?: string;
      }>(`/booking/availability?addressId=${encodeURIComponent(addressId)}`);
      setAreaLabel(res.data.areaLabel);
      setAvailableServices(res.data.availableServices);
      setSlots(res.data.slots);
      setDispatchNote(res.data.dispatchNote ?? '');
      if (res.data.slots[0] && !form.scheduledPickupAt) {
        setForm((f) => ({ ...f, scheduledPickupAt: res.data.slots[0].startAt }));
      }
    },
    [api, form.scheduledPickupAt],
  );

  useEffect(() => {
    if (form.addressId) loadAvailability(form.addressId).catch(() => setError('Could not load schedule'));
  }, [form.addressId, loadAvailability]);

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
    if (step === 'service' && !form.bookingType) {
      setError('Select a service');
      return;
    }
    if (step === 'address') {
      if (!form.addressId) {
        setError('Select a pickup address');
        return;
      }
      try {
        await loadAvailability(form.addressId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Address not available');
        return;
      }
    }
    if (step === 'schedule' && !form.scheduledPickupAt) {
      setError('Select a pickup time');
      return;
    }
    if (step === 'weight' && localQuote && !localQuote.meetsMinimum) {
      setError(`Minimum order is ${formatCurrency(BOOKING_MIN_ORDER_AMOUNT)}. Increase weight or add add-ons.`);
      return;
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
  const currentIdx = BOOKING_STEPS.findIndex((s) => s.id === step);

  return (
    <div>
      <nav className="mb-8 overflow-x-auto">
        <ol className="flex min-w-max gap-1">
          {BOOKING_STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                i === currentIdx
                  ? 'bg-primary text-white'
                  : i < currentIdx
                    ? 'bg-accent/20 text-accent'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {s.label}
            </li>
          ))}
        </ol>
      </nav>

      {step === 'service' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Select service</h2>
          {services.map((s) => {
            const areaOk =
              availableServices.length === 0 || availableServices.includes(s.type);
            return (
              <button
                key={s.type}
                type="button"
                disabled={form.addressId ? !areaOk : false}
                onClick={() => setForm((f) => ({ ...f, bookingType: s.type }))}
                className={`w-full rounded-lg border p-4 text-left disabled:opacity-50 ${
                  form.bookingType === s.type ? 'border-primary bg-indigo-50' : ''
                }`}
              >
                <p className="font-medium">{s.label}</p>
                <p className="text-sm text-slate-500">{s.description}</p>
                <p className="mt-1 text-sm text-primary">
                  {formatCurrency(s.pricePerKg)} / kg · min {s.minWeightKg} kg
                </p>
              </button>
            );
          })}
        </section>
      )}

      {step === 'address' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pickup address</h2>
          <p className="text-sm text-slate-500">
            Service availability depends on your area. After payment, Lunara assigns your laundry partner.
          </p>
          {dispatchNote && (
            <div className="rounded-lg border border-primary/30 bg-indigo-50 p-4 text-sm text-slate-700">
              {dispatchNote}
            </div>
          )}
          {addresses.length === 0 ? (
            <p className="text-sm text-amber-700">
              No addresses saved.{' '}
              <Link href="/onboarding/address" className="text-primary underline">
                Add an address
              </Link>
            </p>
          ) : (
            addresses.map((a) => (
              <button
                key={a._id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, addressId: a._id, scheduledPickupAt: '' }))}
                className={`w-full rounded-lg border p-4 text-left ${
                  form.addressId === a._id ? 'border-primary bg-indigo-50' : ''
                }`}
              >
                <p className="font-medium">{a.label}</p>
                <p className="text-sm text-slate-600">
                  {a.line1}, {a.city}, {a.province} {a.postalCode}
                </p>
              </button>
            ))
          )}
        </section>
      )}

      {step === 'schedule' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pickup schedule</h2>
          {areaLabel && (
            <p className="text-sm text-accent">Serving: {areaLabel}</p>
          )}
          {slots.length === 0 ? (
            <p className="text-sm text-slate-500">No slots available. Try another day or address.</p>
          ) : (
            slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                disabled={!slot.available}
                onClick={() => setForm((f) => ({ ...f, scheduledPickupAt: slot.startAt }))}
                className={`w-full rounded-lg border p-3 text-left text-sm disabled:opacity-40 ${
                  form.scheduledPickupAt === slot.startAt ? 'border-primary bg-indigo-50' : ''
                }`}
              >
                {slot.label}
              </button>
            ))
          )}
        </section>
      )}

      {step === 'weight' && (
        <section>
          <h2 className="text-lg font-semibold">Estimate weight</h2>
          <p className="mt-1 text-sm text-slate-500">
            We&apos;ll confirm actual weight at pickup. Min order{' '}
            {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
          </p>
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-primary">{form.weightKg} kg</span>
              {activeQuote && (
                <span className="text-sm text-slate-600">
                  Service: {formatCurrency(activeQuote.serviceSubtotal)}
                </span>
              )}
            </div>
            <input
              type="range"
              min={config?.minWeightKg ?? 1}
              max={config?.maxWeightKg ?? 50}
              value={form.weightKg}
              onChange={(e) => setForm((f) => ({ ...f, weightKg: Number(e.target.value) }))}
              className="mt-4 w-full accent-primary"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{config?.minWeightKg ?? 1} kg</span>
              <span>{config?.maxWeightKg ?? 50} kg</span>
            </div>
          </div>
        </section>
      )}

      {step === 'addons' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Add-ons (optional)</h2>
          {addons.map((a) => {
            const selected = form.addonIds.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    addonIds: selected
                      ? f.addonIds.filter((id) => id !== a.id)
                      : [...f.addonIds, a.id],
                  }))
                }
                className={`w-full rounded-lg border p-4 text-left ${
                  selected ? 'border-primary bg-indigo-50' : ''
                }`}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{a.label}</span>
                  <span className="text-primary">+{formatCurrency(a.price)}</span>
                </div>
                <p className="text-sm text-slate-500">{a.description}</p>
              </button>
            );
          })}
        </section>
      )}

      {step === 'review' && activeQuote && (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="text-lg font-semibold">Price estimate</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>
                {activeQuote.serviceLabel} × {activeQuote.weightKg} kg
              </dt>
              <dd>{formatCurrency(activeQuote.serviceSubtotal)}</dd>
            </div>
            {activeQuote.addons.map((a) => (
              <div key={a.id} className="flex justify-between text-slate-600">
                <dt>{a.label}</dt>
                <dd>{formatCurrency(a.price)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2">
              <dt>Delivery fee</dt>
              <dd>{formatCurrency(activeQuote.deliveryFee)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt>Estimated total</dt>
              <dd className="text-primary">{formatCurrency(activeQuote.total)}</dd>
            </div>
          </dl>
          {!activeQuote.meetsMinimum && (
            <p className="mt-3 text-sm text-red-500">
              Below minimum order of {formatCurrency(activeQuote.minimumOrderAmount)}.
            </p>
          )}
        </section>
      )}

      {step === 'confirm' && activeQuote && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Confirm booking</h2>
          <div className="rounded-lg border bg-slate-50 p-4 text-sm space-y-2">
            <p>
              <span className="text-slate-500">Service:</span> {activeQuote.serviceLabel}
            </p>
            <p>
              <span className="text-slate-500">Weight:</span> ~{activeQuote.weightKg} kg
            </p>
            <p>
              <span className="text-slate-500">Pickup:</span>{' '}
              {slots.find((s) => s.startAt === form.scheduledPickupAt)?.label ?? 'Selected slot'}
            </p>
            <p>
              <span className="text-slate-500">Total:</span>{' '}
              <strong>{formatCurrency(activeQuote.total)}</strong>
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Lunara operations assigns your partner branch after payment. Pickup riders are notified once
            dispatched. Final amount may adjust after weigh-in.
          </p>
        </section>
      )}

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-8 flex gap-3">
        {step !== 'service' && (
          <Button type="button" variant="outline" onClick={goBack}>
            Back
          </Button>
        )}
        {step === 'confirm' && (
          <Button type="button" className="flex-1" disabled={loading} onClick={createOrder}>
            {loading ? 'Creating…' : 'Continue to checkout'}
          </Button>
        )}
        {step !== 'confirm' && step !== 'done' && (
          <Button
            type="button"
            className="flex-1"
            disabled={step === 'review' && activeQuote ? !activeQuote.meetsMinimum : false}
            onClick={goNext}
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
