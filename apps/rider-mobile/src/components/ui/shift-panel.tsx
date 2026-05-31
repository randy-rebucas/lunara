import { StyleSheet, Text, View } from 'react-native';
import { Button } from './button';
import { Card } from './card';
import { StatusBadge } from './status-badge';
import { colors, radius, spacing, typography } from '../../theme';
import type { ShiftStatus } from '../../lib/rider-types';

interface ShiftPanelProps {
  shiftStatus: ShiftStatus;
  canGoOnline?: boolean;
  complianceHint?: string;
  onGoOnline: () => void;
  onGoOffline: () => void;
  onStartBreak?: () => void;
  onEndBreak?: () => void;
}

const INDICATOR_LABELS: Record<ShiftStatus, string> = {
  online: 'ON',
  offline: 'OFF',
  break: 'BRK',
};

export function ShiftPanel({
  shiftStatus,
  canGoOnline = true,
  complianceHint,
  onGoOnline,
  onGoOffline,
  onStartBreak,
  onEndBreak,
}: ShiftPanelProps) {
  const online = shiftStatus === 'online';
  const onBreak = shiftStatus === 'break';

  return (
    <Card elevated style={styles.panel}>
      <View style={styles.top}>
        <View>
          <Text style={styles.label}>Shift status</Text>
          <StatusBadge shiftStatus={shiftStatus} />
        </View>
        <View
          style={[
            styles.indicator,
            online ? styles.indicatorOn : onBreak ? styles.indicatorBreak : styles.indicatorOff,
          ]}
        >
          <Text style={styles.indicatorText}>{INDICATOR_LABELS[shiftStatus]}</Text>
        </View>
      </View>
      <Text style={styles.hint}>
        {online
          ? 'You are visible to dispatch. New pickup offers and assignments will appear below.'
          : onBreak
            ? 'You are on break and will not receive new assignments until you resume your shift.'
            : canGoOnline
              ? 'Go online to receive pickup offers and delivery assignments from Lunara dispatch.'
              : complianceHint ??
                'Complete your profile and get all documents approved before starting your shift.'}
      </Text>
      {online ? (
        <View style={styles.actions}>
          <Button label="Take break" variant="outline" onPress={onStartBreak} style={styles.btn} />
          <Button label="End shift" variant="outline" onPress={onGoOffline} style={styles.btn} />
        </View>
      ) : onBreak ? (
        <View style={styles.actions}>
          <Button
            label="Resume shift"
            variant="accent"
            onPress={onEndBreak}
            style={styles.btn}
          />
          <Button label="End shift" variant="outline" onPress={onGoOffline} style={styles.btn} />
        </View>
      ) : (
        <Button
          label="Start shift"
          variant="accent"
          size="lg"
          onPress={onGoOnline}
          disabled={!canGoOnline}
          style={styles.btn}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: spacing.lg },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: { ...typography.label, marginBottom: spacing.xs },
  hint: {
    ...typography.bodySm,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  btn: { marginTop: 0 },
  indicator: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  indicatorOn: {
    backgroundColor: colors.accentLight,
  },
  indicatorBreak: {
    backgroundColor: '#FEF3C7',
  },
  indicatorOff: {
    backgroundColor: colors.surfaceMuted,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.slate700,
  },
});
