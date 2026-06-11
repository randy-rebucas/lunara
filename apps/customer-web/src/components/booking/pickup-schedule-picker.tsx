'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PICKUP_SCHEDULE_DAY_COUNT,
  buildPickupScheduleDays,
  formatPickupSlotTimeWindow,
  isPickupSlotBookable,
  pickupSlotDayKey,
  type PickupSlot,
} from '@lunara/utils';

interface PickupSchedulePickerProps {
  slots: PickupSlot[];
  selectedStartAt: string;
  onSelectStartAt: (startAt: string) => void;
  dayCount?: number;
}

export function PickupSchedulePicker({
  slots,
  selectedStartAt,
  onSelectStartAt,
  dayCount = PICKUP_SCHEDULE_DAY_COUNT,
}: PickupSchedulePickerProps) {
  const scheduleDays = useMemo(
    () => buildPickupScheduleDays(slots, new Date(), dayCount),
    [slots, dayCount],
  );

  const [selectedDayKey, setSelectedDayKey] = useState('');

  useEffect(() => {
    if (selectedStartAt) {
      setSelectedDayKey(pickupSlotDayKey(selectedStartAt));
      return;
    }
    const firstWithSlots = scheduleDays.find((d) => d.hasAvailable);
    const firstAny = scheduleDays.find((d) => d.slots.length > 0);
    setSelectedDayKey((firstWithSlots ?? firstAny)?.key ?? scheduleDays[0]?.key ?? '');
  }, [selectedStartAt, scheduleDays]);

  const selectedDay = scheduleDays.find((d) => d.key === selectedDayKey) ?? scheduleDays[0];
  const timeSlots = selectedDay?.slots ?? [];

  function selectDay(key: string) {
    const day = scheduleDays.find((d) => d.key === key);
    if (!day || (!day.hasAvailable && day.slots.length === 0)) return;

    setSelectedDayKey(key);
    if (selectedStartAt && pickupSlotDayKey(selectedStartAt) === key) return;

    const firstAvailable = day.slots.find((s) => isPickupSlotBookable(s));
    onSelectStartAt(firstAvailable?.startAt ?? '');
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-slate-900">Select a day</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {scheduleDays.map((day) => {
            const selected = day.key === selectedDayKey;
            const disabled = day.slots.length === 0;
            const limited = !disabled && !day.hasAvailable;
            return (
              <button
                key={day.key}
                type="button"
                disabled={disabled}
                onClick={() => selectDay(day.key)}
                className={`flex flex-col items-center rounded-lg px-2 py-3 text-center ring-1 transition-all ${
                  disabled
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 ring-border/30'
                    : selected
                      ? 'bg-primary/5 ring-2 ring-primary/35'
                      : limited
                        ? 'bg-amber-50/80 text-amber-900 ring-amber-200/70 hover:ring-amber-300'
                        : 'bg-surface ring-border/50 hover:ring-border'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {day.weekday}
                </span>
                <span className="mt-0.5 text-lg font-bold leading-none">{day.dayLabel}</span>
                <span className="mt-0.5 text-[10px] text-muted">{day.monthLabel}</span>
                {day.isToday && (
                  <span className="mt-1 text-[10px] font-medium text-primary">Today</span>
                )}
                {limited && !selected && (
                  <span className="mt-1 text-[10px] text-amber-800">Full</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-slate-900">
          {selectedDay
            ? `Pickup time · ${selectedDay.weekday}, ${selectedDay.monthLabel} ${selectedDay.dayLabel}`
            : 'Pickup time'}
        </p>
        {timeSlots.length === 0 ? (
          <p className="text-sm text-muted">No pickup windows on this day. Choose another day.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {timeSlots.map((slot) => {
              const selected = selectedStartAt === slot.startAt;
              const bookable = isPickupSlotBookable(slot);
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!bookable}
                  onClick={() => onSelectStartAt(slot.startAt)}
                  className={`rounded-lg px-4 py-3 text-left text-sm ring-1 transition-all ${
                    !bookable
                      ? 'cursor-not-allowed bg-slate-50 text-slate-400 ring-border/30 line-through'
                      : selected
                        ? 'bg-primary/5 font-medium text-slate-900 ring-2 ring-primary/35'
                        : 'bg-surface text-slate-900 ring-border/50 hover:ring-border'
                  }`}
                >
                  {formatPickupSlotTimeWindow(slot)}
                  {!bookable && (
                    <span className="mt-1 block text-xs font-normal text-slate-400">Unavailable</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
