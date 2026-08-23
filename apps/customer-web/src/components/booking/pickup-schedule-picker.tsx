'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildPickupDayOptions,
  manilaDateAndTimeToIso,
  PICKUP_SCHEDULE_DAY_COUNT,
  validatePickupTime,
  type BranchHoliday,
} from '@lunara/utils';
import type { OperatingHours } from '@lunara/types';

interface PickupSchedulePickerProps {
  operatingHours: OperatingHours;
  holidays?: BranchHoliday[];
  dayCount?: number;
  serverNow?: string;
  selectedStartAt: string;
  onSelectStartAt: (startAt: string) => void;
}

/** Extracts the "HH:mm" wall-clock time a selected ISO instant represents, for prefilling the
 * time input — the actual instant math lives in manilaDateAndTimeToIso/validatePickupTime. */
function isoToManilaTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Extracts the YYYY-MM-DD Manila calendar date a selected ISO instant falls on. */
function isoToManilaDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));
}

const TIME_BLOCK_STEP_MINUTES = 15;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "HH:mm" -> "8:00 AM". */
function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function PickupSchedulePicker({
  operatingHours,
  holidays = [],
  dayCount = PICKUP_SCHEDULE_DAY_COUNT,
  serverNow,
  selectedStartAt,
  onSelectStartAt,
}: PickupSchedulePickerProps) {
  const now = useMemo(() => (serverNow ? new Date(serverNow) : new Date()), [serverNow]);
  const dayOptions = useMemo(
    () => buildPickupDayOptions(operatingHours, holidays, dayCount, now),
    [operatingHours, holidays, dayCount, now],
  );

  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [timeInput, setTimeInput] = useState('');

  // Initialize once options are known: prefill from an existing selection (e.g. rescheduling an
  // order's current pickup time) if given, otherwise default to the earliest bookable time.
  useEffect(() => {
    if (selectedDayKey) return;
    if (dayOptions.length === 0) return;

    if (selectedStartAt) {
      const key = isoToManilaDateKey(selectedStartAt);
      if (dayOptions.some((d) => d.key === key)) {
        setSelectedDayKey(key);
        setTimeInput(isoToManilaTime(selectedStartAt));
        return;
      }
    }

    const firstOpen = dayOptions.find((d) => !d.isClosed && d.earliestBookableTime);
    if (!firstOpen) return;
    setSelectedDayKey(firstOpen.key);
    setTimeInput(firstOpen.earliestBookableTime!);
    onSelectStartAt(manilaDateAndTimeToIso(firstOpen.key, firstOpen.earliestBookableTime!));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOptions]);

  const selectedDay = dayOptions.find((d) => d.key === selectedDayKey) ?? dayOptions[0];

  const timeOptions = useMemo(() => {
    if (!selectedDay || selectedDay.isClosed || !selectedDay.openTime || !selectedDay.closeTime) {
      return [];
    }
    const startMinutes = timeToMinutes(selectedDay.earliestBookableTime ?? selectedDay.openTime);
    const roundedStart =
      Math.ceil(startMinutes / TIME_BLOCK_STEP_MINUTES) * TIME_BLOCK_STEP_MINUTES;
    const endMinutes = timeToMinutes(selectedDay.closeTime);
    const options: string[] = [];
    for (let m = roundedStart; m < endMinutes; m += TIME_BLOCK_STEP_MINUTES) {
      options.push(minutesToTime(m));
    }
    return options;
  }, [selectedDay]);

  function selectDay(key: string) {
    const day = dayOptions.find((d) => d.key === key);
    if (!day || day.isClosed) return;
    setSelectedDayKey(key);
    const time = day.earliestBookableTime ?? day.openTime ?? '08:00';
    setTimeInput(time);
    onSelectStartAt(manilaDateAndTimeToIso(key, time));
  }

  function handleTimeChange(time: string) {
    setTimeInput(time);
    if (!selectedDay || !time) {
      onSelectStartAt('');
      return;
    }
    const candidate = manilaDateAndTimeToIso(selectedDay.key, time);
    const result = validatePickupTime(candidate, operatingHours, holidays, now);
    onSelectStartAt(result.valid ? candidate : '');
  }

  const validation = useMemo(() => {
    if (!selectedDay || !timeInput) return undefined;
    const candidate = manilaDateAndTimeToIso(selectedDay.key, timeInput);
    return validatePickupTime(candidate, operatingHours, holidays, now);
  }, [selectedDay, timeInput, operatingHours, holidays, now]);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-slate-900">Select a day</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {dayOptions.map((day) => {
            const selected = day.key === selectedDayKey;
            return (
              <button
                key={day.key}
                type="button"
                disabled={day.isClosed}
                onClick={() => selectDay(day.key)}
                className={`flex flex-col items-center rounded-lg px-2 py-3 text-center ring-1 transition-all ${
                  day.isClosed
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 ring-border/30'
                    : selected
                      ? 'bg-primary/5 ring-2 ring-primary/35'
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
                {day.isClosed && (
                  <span className="mt-1 text-[10px] text-amber-800">
                    {day.holidayLabel ?? 'Closed'}
                  </span>
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
        {!selectedDay || selectedDay.isClosed ? (
          <p className="text-sm text-muted">
            {selectedDay?.holidayLabel ?? 'Closed'}. Choose another day.
          </p>
        ) : timeOptions.length === 0 ? (
          <p className="text-sm text-muted">No pickup times left today. Choose another day.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
              {timeOptions.map((time) => {
                const selected = time === timeInput;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleTimeChange(time)}
                    className={`rounded-lg px-2 py-2 text-center text-sm font-medium ring-1 transition-all ${
                      selected
                        ? 'bg-primary/5 text-primary ring-2 ring-primary/35'
                        : 'bg-surface ring-border/50 hover:ring-border'
                    }`}
                  >
                    {formatTimeLabel(time)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">
              Open {selectedDay.openTime}–{selectedDay.closeTime}, 15-minute increments.
            </p>
            {validation && !validation.valid && (
              <p className="text-xs font-medium text-amber-700">{validation.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
