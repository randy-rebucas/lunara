import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  PICKUP_SCHEDULE_DAY_COUNT,
  buildPickupScheduleDays,
  formatPickupSlotTimeWindow,
  isPickupSlotBookable,
  pickupSlotDayKey,
  type PickupSlot,
} from '@lunara/utils';
import { colors, radius, spacing } from '../theme';

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
    if (!day || day.slots.length === 0) return;

    setSelectedDayKey(key);
    if (selectedStartAt && pickupSlotDayKey(selectedStartAt) === key) return;

    const firstAvailable = day.slots.find((s) => isPickupSlotBookable(s));
    onSelectStartAt(firstAvailable?.startAt ?? '');
  }

  return (
    <View>
      <Text style={styles.label}>Select a day</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}
      >
        {scheduleDays.map((day) => {
          const selected = day.key === selectedDayKey;
          const disabled = day.slots.length === 0;
          const limited = !disabled && !day.hasAvailable;
          return (
            <Pressable
              key={day.key}
              disabled={disabled}
              onPress={() => selectDay(day.key)}
              style={[
                styles.dayChip,
                disabled
                  ? styles.dayChipDisabled
                  : selected
                    ? styles.dayChipSelected
                    : limited
                      ? styles.dayChipLimited
                      : null,
              ]}
            >
              <Text style={[styles.dayWeekday, disabled && styles.dayTextDisabled]}>
                {day.weekday}
              </Text>
              <Text style={[styles.dayNumber, disabled && styles.dayTextDisabled]}>
                {day.dayLabel}
              </Text>
              <Text style={[styles.dayMonth, disabled && styles.dayTextDisabled]}>
                {day.monthLabel}
              </Text>
              {day.isToday ? <Text style={styles.dayToday}>Today</Text> : null}
              {limited && !selected ? <Text style={styles.dayFull}>Full</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>
        {selectedDay
          ? `Pickup time · ${selectedDay.weekday}, ${selectedDay.monthLabel} ${selectedDay.dayLabel}`
          : 'Pickup time'}
      </Text>
      {timeSlots.length === 0 ? (
        <Text style={styles.emptyText}>No pickup windows on this day. Choose another day.</Text>
      ) : (
        timeSlots.map((slot) => {
          const selected = selectedStartAt === slot.startAt;
          const bookable = isPickupSlotBookable(slot);
          return (
            <Pressable
              key={slot.id}
              disabled={!bookable}
              onPress={() => onSelectStartAt(slot.startAt)}
              style={[
                styles.slotRow,
                selected && styles.slotRowSelected,
                !bookable && styles.slotRowDisabled,
              ]}
            >
              <Text style={[styles.slotText, !bookable && styles.dayTextDisabled]}>
                {formatPickupSlotTimeWindow(slot)}
              </Text>
              {!bookable ? <Text style={styles.slotUnavailable}>Unavailable</Text> : null}
            </Pressable>
          );
        })
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
  dayChipLimited: { borderColor: colors.warningBorder, backgroundColor: colors.warningBg },
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
  slotRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.lg - 2,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  slotRowSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  slotRowDisabled: { opacity: 0.4 },
  slotText: { fontSize: 15, fontWeight: '500', color: colors.foreground },
  slotUnavailable: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
});
