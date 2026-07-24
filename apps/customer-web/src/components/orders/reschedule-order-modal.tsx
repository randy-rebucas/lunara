'use client';

import { useEffect, useState } from 'react';
import { Button } from '@lunara/ui';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import type { BranchHoliday, PickupSlot } from '@lunara/utils';
import { PickupSchedulePicker } from '../booking/pickup-schedule-picker';

interface RescheduleOrderModalProps {
  orderId: string;
  pickupAddressId?: string;
  branchId?: string;
  onClose: () => void;
  onRescheduled: () => void;
}

export function RescheduleOrderModal({
  orderId,
  pickupAddressId,
  branchId,
  onClose,
  onRescheduled,
}: RescheduleOrderModalProps) {
  const { api } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [holidays, setHolidays] = useState<BranchHoliday[]>([]);
  const [selectedStartAt, setSelectedStartAt] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!pickupAddressId) {
      setLoading(false);
      setError('Could not load pickup slots for this order.');
      return;
    }
    setLoading(true);
    const branchParam = branchId ? `&branchId=${encodeURIComponent(branchId)}` : '';
    api
      .get<{ slots: PickupSlot[]; holidays?: BranchHoliday[] }>(
        `/booking/availability?addressId=${encodeURIComponent(pickupAddressId)}${branchParam}`,
      )
      .then((res) => {
        setSlots(res.data.slots);
        setHolidays(res.data.holidays ?? []);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load pickup slots');
        setSlots([]);
      })
      .finally(() => setLoading(false));
  }, [pickupAddressId, branchId, api]);

  async function handleSubmit() {
    if (!selectedStartAt) return;
    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/orders/${orderId}/reschedule`, { scheduledPickupAt: selectedStartAt });
      onRescheduled();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reschedule pickup');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div className="absolute inset-0" aria-hidden onClick={() => !submitting && onClose()} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface shadow-[var(--shadow-elevated)]">
        <div className="card-body">
          <h2 className="text-lg font-semibold text-slate-900">Reschedule pickup</h2>

          {loading ? (
            <p className="mt-4 text-sm text-muted">Loading available pickup slots…</p>
          ) : slots.length > 0 ? (
            <div className="mt-4">
              <PickupSchedulePicker
                slots={slots}
                selectedStartAt={selectedStartAt}
                onSelectStartAt={setSelectedStartAt}
                holidays={holidays}
              />
            </div>
          ) : !error ? (
            <p className="mt-4 text-sm text-muted">No pickup slots available for this address.</p>
          ) : null}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || !selectedStartAt}
            >
              {submitting ? 'Saving…' : 'Confirm new pickup time'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
