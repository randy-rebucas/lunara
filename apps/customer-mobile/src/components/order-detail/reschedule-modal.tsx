import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { OperatingHours } from '@lunara/types';
import type { BranchHoliday } from '@lunara/utils';
import { Button } from '../ui/button';
import { PickupSchedulePicker } from '../pickup-schedule-picker';
import { colors, radius, spacing } from '../../theme';
import { toErrorMessage } from '../../lib/api-error';

interface RescheduleModalProps {
  visible: boolean;
  onClose: () => void;
  pickupAddressId?: string;
  branchId?: string;
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  /** Performs the actual `PATCH /orders/:id/reschedule` call. */
  onReschedule: (newStartAt: string) => Promise<void>;
  /** Called after a successful reschedule, once the modal has already closed itself. */
  onRescheduled: () => void;
}

/** Pickup-reschedule form, extracted from `orders/[id]/index.tsx` — owns its own available-slots
 * fetch + selection + submit state, only talking to the parent screen via `onReschedule`. */
export function RescheduleModal({
  visible,
  onClose,
  pickupAddressId,
  branchId,
  apiFetch,
  onReschedule,
  onRescheduled,
}: RescheduleModalProps) {
  const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null);
  const [holidays, setHolidays] = useState<BranchHoliday[]>([]);
  const [serverNow, setServerNow] = useState<string | undefined>(undefined);
  const [selectedStartAt, setSelectedStartAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setError('');
    setSelectedStartAt('');
    if (!pickupAddressId) {
      setError('Could not load pickup schedule for this order.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const branchParam = branchId ? `&branchId=${encodeURIComponent(branchId)}` : '';
        const avail = await apiFetch<{
          operatingHours: OperatingHours;
          holidays?: BranchHoliday[];
          serverNow?: string;
        }>(`/booking/availability?addressId=${encodeURIComponent(pickupAddressId)}${branchParam}`);
        if (cancelled) return;
        setOperatingHours(avail.operatingHours);
        setHolidays(avail.holidays ?? []);
        setServerNow(avail.serverNow);
      } catch (e) {
        if (cancelled) return;
        setError(toErrorMessage(e, 'Could not load pickup schedule'));
        setOperatingHours(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pickupAddressId, branchId]);

  async function handleSubmit() {
    if (!selectedStartAt) return;
    setSubmitting(true);
    setError('');
    try {
      await onReschedule(selectedStartAt);
      onRescheduled();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not reschedule pickup'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={styles.sheetPanel}>
          <View style={styles.sheetHandle} />
          <View style={styles.cardHeaderRow}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.actionTitle}>Reschedule pickup</Text>
          </View>

          {loading ? (
            <Text style={styles.meta}>Loading available pickup schedule…</Text>
          ) : operatingHours ? (
            <PickupSchedulePicker
              operatingHours={operatingHours}
              holidays={holidays}
              serverNow={serverNow}
              selectedStartAt={selectedStartAt}
              onSelectStartAt={setSelectedStartAt}
            />
          ) : !error ? (
            <Text style={styles.meta}>No pickup schedule available for this address.</Text>
          ) : null}

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={submitting ? 'Saving…' : 'Confirm new pickup time'}
            onPress={handleSubmit}
            disabled={submitting || !selectedStartAt}
            style={styles.actionBtn}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheetBackdrop: { flex: 1 },
  sheetPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionTitle: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  meta: { color: colors.muted, fontSize: 13 },
  actionBtn: { marginTop: spacing.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  error: { color: colors.destructive, fontSize: 13 },
});
