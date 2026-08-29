'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { PartnerOwnedRider } from '@lunara/types';
import { removeOwnedRider, updateOwnedRider } from '../lib/partner-api';

export function RiderProfileModal({
  rider,
  onClose,
  onSaved,
}: {
  rider: PartnerOwnedRider;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [firstName, setFirstName] = useState(rider.firstName ?? '');
  const [lastName, setLastName] = useState(rider.lastName ?? '');
  const [vehicleType, setVehicleType] = useState(rider.vehicleType ?? 'motorcycle');
  const [plateNumber, setPlateNumber] = useState(rider.plateNumber ?? '');
  const [orCrNumber, setOrCrNumber] = useState(rider.orCrNumber ?? '');
  const [employmentType, setEmploymentType] = useState(rider.employmentType ?? 'independent_contractor');
  const [fixedWageAmount, setFixedWageAmount] = useState(
    rider.fixedWageAmount != null ? String(rider.fixedWageAmount) : '',
  );
  const [wageFrequency, setWageFrequency] = useState(rider.wageFrequency ?? 'weekly');
  const [saving, setSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  async function handleSave() {
    setSaving(true);
    try {
      await updateOwnedRider(rider.userId, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        vehicleType,
        plateNumber: plateNumber.trim() || undefined,
        orCrNumber: orCrNumber.trim() || undefined,
        employmentType,
        ...(employmentType === 'employee'
          ? {
              fixedWageAmount: fixedWageAmount ? Number(fixedWageAmount) : undefined,
              wageFrequency,
            }
          : {}),
      });
      await onSaved();
      toast.success('Rider updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update rider');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoveError('');
    setRemoving(true);
    try {
      await removeOwnedRider(rider.userId);
      await onSaved();
      toast.success('Rider removed');
      onClose();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Could not remove rider');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Edit rider</h3>
        <p className="mt-1 text-sm text-muted">{rider.email ?? rider.userId}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">First name</span>
            <input
              type="text"
              className="input"
              maxLength={80}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">Last name</span>
            <input
              type="text"
              className="input"
              maxLength={80}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">Vehicle</span>
            <select className="input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="motorcycle">Motorcycle</option>
              <option value="bicycle">Bicycle</option>
              <option value="car">Car</option>
              <option value="van">Van</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">Plate number</span>
            <input
              type="text"
              className="input"
              maxLength={20}
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-900">OR/CR number</span>
          <input
            type="text"
            className="input"
            maxLength={40}
            value={orCrNumber}
            onChange={(e) => setOrCrNumber(e.target.value)}
          />
        </label>

        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-slate-900">Pay setup</p>
          <p className="mt-1 text-xs text-muted">
            This is your own record for how you pay this rider — Lunara does not process their payout.
          </p>
          <label className="mt-2 block">
            <span className="mb-1 block text-sm font-medium text-slate-900">Type</span>
            <select
              className="input"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as typeof employmentType)}
            >
              <option value="independent_contractor">Independent contractor</option>
              <option value="employee">Employee</option>
            </select>
          </label>
          {employmentType === 'employee' && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                type="number"
                min={0}
                className="input"
                placeholder="Wage amount"
                value={fixedWageAmount}
                onChange={(e) => setFixedWageAmount(e.target.value)}
              />
              <select
                className="input"
                value={wageFrequency}
                onChange={(e) => setWageFrequency(e.target.value as typeof wageFrequency)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700">Remove rider</p>
          <p className="mt-1 text-xs text-red-600">
            {confirmingRemove
              ? 'This will deactivate their account. This cannot be undone from here.'
              : 'They will no longer be able to sign in or be assigned tasks.'}
          </p>
          {removeError && <p className="mt-2 text-sm text-red-700">{removeError}</p>}
          <div className="mt-2 flex gap-2">
            {confirmingRemove ? (
              <>
                <button
                  type="button"
                  className="btn-sm rounded-lg bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 disabled:opacity-50"
                  disabled={removing}
                  onClick={() => void handleRemove()}
                >
                  {removing ? 'Removing…' : 'Confirm remove'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={removing}
                  onClick={() => setConfirmingRemove(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="btn-outline btn-sm" onClick={() => setConfirmingRemove(true)}>
                Remove rider
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
