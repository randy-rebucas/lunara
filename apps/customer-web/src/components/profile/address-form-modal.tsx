'use client';

import { useEffect, useState } from 'react';
import { AddressType } from '@lunara/types';
import { Button } from '@lunara/ui';
import {
  ADDRESS_TYPE_OPTIONS,
  defaultLabelForAddressType,
  formatAddressTypeLabel,
  reverseGeocodeAddress,
} from '@lunara/utils';
import { FormLabel, Input } from '../ui/input';
import type { AddressFormValues, CustomerAddress } from '../../lib/profile-types';
import { addressToForm, emptyAddressForm } from '../../lib/profile-types';

function selectAddressType(form: AddressFormValues, addressType: AddressType): AddressFormValues {
  const suggested = defaultLabelForAddressType(addressType);
  const labelStillDefault = ADDRESS_TYPE_OPTIONS.some((o) => o.label === form.label);
  return {
    ...form,
    addressType,
    label: labelStillDefault ? suggested : form.label,
  };
}

export function AddressFormModal({
  open,
  editing,
  hasAddresses,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  editing?: CustomerAddress | null;
  hasAddresses: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (values: AddressFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<AddressFormValues>(emptyAddressForm());
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm(addressToForm(editing));
    } else {
      setForm({ ...emptyAddressForm(), isDefault: !hasAddresses });
    }
  }, [open, editing, hasAddresses]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.line1.trim() || !form.city.trim() || !form.postalCode.trim()) {
      setError('Street, city, and postal code are required.');
      return;
    }
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save address');
    }
  }

  async function useBrowserLocation() {
    if (!navigator.geolocation) {
      setError('Location is not supported in this browser.');
      return;
    }
    setLocating(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        let geocoded: Awaited<ReturnType<typeof reverseGeocodeAddress>> = null;
        try {
          geocoded = await reverseGeocodeAddress(latitude, longitude);
        } catch {
          /* coords still useful without address text */
        }

        setForm((f) => ({
          ...f,
          latitude,
          longitude,
          ...(geocoded
            ? {
                line1: geocoded.line1 || f.line1,
                line2: geocoded.line2 || f.line2,
                city: geocoded.city || f.city,
                province: geocoded.province || f.province,
                postalCode: geocoded.postalCode || f.postalCode,
              }
            : {}),
        }));

        if (!geocoded) {
          setError('Location pinned. Review or complete the address fields below.');
        }
        setLocating(false);
      },
      () => {
        setError('Could not get your location. Enter the address manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div
        className="absolute inset-0"
        aria-hidden
        onClick={() => !saving && onClose()}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface shadow-[var(--shadow-elevated)]">
        <div className="card-body">
          <h2 className="text-lg font-semibold text-slate-900">
            {editing ? 'Edit address' : 'Add address'}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <FormLabel>Type</FormLabel>
              <div className="flex flex-wrap gap-2">
                {ADDRESS_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => selectAddressType(f, opt.value))}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                      form.addressType === opt.value
                        ? 'bg-primary text-white ring-primary'
                        : 'bg-surface text-muted ring-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FormLabel>Label</FormLabel>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
                maxLength={50}
              />
            </div>

            <div>
              <FormLabel>Street address</FormLabel>
              <Input
                value={form.line1}
                onChange={(e) => setForm({ ...form, line1: e.target.value })}
                required
              />
            </div>

            <div>
              <FormLabel>Unit / building (optional)</FormLabel>
              <Input
                value={form.line2}
                onChange={(e) => setForm({ ...form, line2: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel>City</FormLabel>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <FormLabel>Province</FormLabel>
                <Input
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <FormLabel>Postal code</FormLabel>
              <Input
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                required
              />
            </div>

            {form.latitude != null && form.longitude != null && (
              <p className="text-xs font-medium text-accent">
                GPS pinned ({form.latitude.toFixed(4)}, {form.longitude.toFixed(4)})
              </p>
            )}

            <Button type="button" variant="outline" disabled={locating} onClick={useBrowserLocation}>
              {locating ? 'Getting location & address…' : 'Use my location'}
            </Button>

            {hasAddresses && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="accent-primary"
                />
                Set as default pickup address
              </label>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="btn-row sm:justify-end">
              <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add address'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AddressTypeBadge({ type }: { type?: string }) {
  return (
    <span className="badge-secondary">{formatAddressTypeLabel(type)}</span>
  );
}
