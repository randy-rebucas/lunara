import { StyleSheet, Text, View } from 'react-native';
import { Button } from './button';
import { Card } from './card';
import { StatusBadge } from './status-badge';
import { colors, radius, spacing, typography } from '../../theme';

interface ShiftPanelProps {
  online: boolean;
  onGoOnline: () => void;
  onGoOffline: () => void;
}

export function ShiftPanel({ online, onGoOnline, onGoOffline }: ShiftPanelProps) {
  return (
    <Card elevated style={styles.panel}>
      <View style={styles.top}>
        <View>
          <Text style={styles.label}>Shift status</Text>
          <StatusBadge online={online} />
        </View>
        <View style={[styles.indicator, online ? styles.indicatorOn : styles.indicatorOff]}>
          <Text style={styles.indicatorText}>{online ? 'ON' : 'OFF'}</Text>
        </View>
      </View>
      <Text style={styles.hint}>
        {online
          ? 'You are visible to dispatch. New pickup offers and assignments will appear below.'
          : 'Go online to receive pickup offers and delivery assignments from Lunara dispatch.'}
      </Text>
      {online ? (
        <Button label="End shift" variant="outline" onPress={onGoOffline} style={styles.btn} />
      ) : (
        <Button label="Start shift" variant="accent" size="lg" onPress={onGoOnline} style={styles.btn} />
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
  btn: { marginTop: spacing.lg },
  indicator: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  indicatorOn: {
    backgroundColor: colors.accentLight,
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
