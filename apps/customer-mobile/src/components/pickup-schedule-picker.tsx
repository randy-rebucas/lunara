import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  buildPickupDayOptions,
  manilaDateAndTimeToIso,
  PICKUP_SCHEDULE_DAY_COUNT,
  validatePickupTime,
  type BranchHoliday,
} from '@lunara/utils';
import type { OperatingHours } from '@lunara/types';
import { colors, radius, spacing } from '../theme';

interface PickupSchedulePickerProps {
  operatingHours: OperatingHours;
  holidays?: BranchHoliday[];
  dayCount?: number;
  serverNow?: string;
  selectedStartAt: string;
  onSelectStartAt: (startAt: string) => void;
}

const TIME_STEP_MINUTES = 15;

function isoToManilaTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function isoToManilaDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
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
  const [timeValue, setTimeValue] = useState('');

  useEffect(() => {
    if (selectedDayKey) return;
    if (dayOptions.length === 0) return;

    if (selectedStartAt) {
      const key = isoToManilaDateKey(selectedStartAt);
      if (dayOptions.some((d) => d.key === key)) {
        setSelectedDayKey(key);
        setTimeValue(isoToManilaTime(selectedStartAt));
        return;
      }
    }

    const firstOpen = dayOptions.find((d) => !d.isClosed && d.earliestBookableTime);
    if (!firstOpen) return;
    setSelectedDayKey(firstOpen.key);
    setTimeValue(firstOpen.earliestBookableTime!);
    onSelectStartAt(manilaDateAndTimeToIso(firstOpen.key, firstOpen.earliestBookableTime!));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayOptions]);

  const selectedDay = dayOptions.find((d) => d.key === selectedDayKey) ?? dayOptions[0];

  function selectDay(key: string) {
    const day = dayOptions.find((d) => d.key === key);
    if (!day || day.isClosed) return;
    setSelectedDayKey(key);
    const time = day.earliestBookableTime ?? day.openTime ?? '08:00';
    setTimeValue(time);
    onSelectStartAt(manilaDateAndTimeToIso(key, time));
  }

  function applyTime(time: string) {
    setTimeValue(time);
    if (!selectedDay) {
      onSelectStartAt('');
      return;
    }
    const candidate = manilaDateAndTimeToIso(selectedDay.key, time);
    const result = validatePickupTime(candidate, operatingHours, holidays, now);
    onSelectStartAt(result.valid ? candidate : '');
  }

  function step(deltaMinutes: number) {
    if (!timeValue) return;
    applyTime(minutesToTime(timeToMinutes(timeValue) + deltaMinutes));
  }

  const validation = useMemo(() => {
    if (!selectedDay || !timeValue) return undefined;
    const candidate = manilaDateAndTimeToIso(selectedDay.key, timeValue);
    return validatePickupTime(candidate, operatingHours, holidays, now);
  }, [selectedDay, timeValue, operatingHours, holidays, now]);

  return (
    <View>
      <Text style={styles.label}>Select a day</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}
      >
        {dayOptions.map((day) => {
          const selected = day.key === selectedDayKey;
          return (
            <Pressable
              key={day.key}
              disabled={day.isClosed}
              onPress={() => selectDay(day.key)}
              style={[
                styles.dayChip,
                day.isClosed ? styles.dayChipDisabled : selected ? styles.dayChipSelected : null,
              ]}
            >
              <Text style={[styles.dayWeekday, day.isClosed && styles.dayTextDisabled]}>
                {day.weekday}
              </Text>
              <Text style={[styles.dayNumber, day.isClosed && styles.dayTextDisabled]}>
                {day.dayLabel}
              </Text>
              <Text style={[styles.dayMonth, day.isClosed && styles.dayTextDisabled]}>
                {day.monthLabel}
              </Text>
              {day.isToday ? <Text style={styles.dayToday}>Today</Text> : null}
              {day.isClosed ? <Text style={styles.dayFull}>{day.holidayLabel ?? 'Closed'}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>
        {selectedDay
          ? `Pickup time · ${selectedDay.weekday}, ${selectedDay.monthLabel} ${selectedDay.dayLabel}`
          : 'Pickup time'}
      </Text>
      {!selectedDay || selectedDay.isClosed ? (
        <Text style={styles.emptyText}>
          {selectedDay?.holidayLabel ?? 'Closed'}. Choose another day.
        </Text>
      ) : (
        <View>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => step(-TIME_STEP_MINUTES)}
              disabled={!timeValue}
            >
              <Text style={styles.stepperButtonText}>−15m</Text>
            </Pressable>
            <View style={styles.stepperDisplay}>
              <Text style={styles.stepperTime}>{timeValue ? formatTimeLabel(timeValue) : '--:--'}</Text>
            </View>
            <Pressable
              style={styles.stepperButton}
              onPress={() => step(TIME_STEP_MINUTES)}
              disabled={!timeValue}
            >
              <Text style={styles.stepperButtonText}>+15m</Text>
            </Pressable>
          </View>
          <Text style={styles.hoursText}>
            Open {formatTimeLabel(selectedDay.openTime!)}–{formatTimeLabel(selectedDay.closeTime!)}
          </Text>
          {validation && !validation.valid ? (
            <Text style={styles.slotUnavailable}>{validation.message}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: spacing.sm },
  dayRow: { gap: spacing.sm, paddingBottom: spacing.md, paddingRight: spacing.sm },
  dayChip: {
    width: 64,
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
  },
  dayChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dayChipDisabled: { opacity: 0.4 },
  dayWeekday: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.muted,
    letterSpacing: 0.4,
  },
  dayNumber: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginTop: 2 },
  dayMonth: { fontSize: 10, color: colors.muted, marginTop: 2 },
  dayToday: { fontSize: 10, fontWeight: '600', color: colors.primary, marginTop: spacing.xs },
  dayFull: { fontSize: 10, fontWeight: '600', color: colors.warning, marginTop: spacing.xs },
  dayTextDisabled: { color: colors.mutedForeground },
  emptyText: { fontSize: 13, color: colors.muted, marginBottom: spacing.md },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepperButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  stepperButtonText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  stepperDisplay: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md - 2,
    backgroundColor: colors.primaryLight,
  },
  stepperTime: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  hoursText: { fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
  slotUnavailable: { fontSize: 12, fontWeight: '600', color: colors.warning },
});
