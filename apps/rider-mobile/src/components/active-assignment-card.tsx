import { StyleSheet, Text, View } from 'react-native';
import type { ActiveAssignment } from '../lib/rider-types';
import { riderTaskStatusLabel } from '../rider-labels';
import { colors, spacing, typography } from '../theme';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { TaskTypeBadge } from './ui/task-type-badge';

interface ActiveAssignmentCardProps {
  assignment: ActiveAssignment;
  onViewTask: () => void;
  onNavigate: () => void;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function ActiveAssignmentCard({
  assignment,
  onViewTask,
  onNavigate,
}: ActiveAssignmentCardProps) {
  return (
    <Card elevated style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Active assignment</Text>
        <TaskTypeBadge type={assignment.leg === 'delivery' ? 'delivery' : 'active'} />
      </View>

      <DetailRow label="Order number" value={assignment.orderNumber} />
      <DetailRow label="Customer" value={assignment.customerName} />
      <DetailRow label="Service type" value={assignment.serviceType} />
      <Text style={styles.step}>
        Step {assignment.workflowStep + 1} of {assignment.workflowTotal} · {assignment.workflowLabel}
      </Text>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Distance</Text>
          <Text style={styles.metricValue}>{assignment.distanceLabel}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>ETA</Text>
          <Text style={styles.metricValue}>{assignment.etaLabel}</Text>
        </View>
      </View>
      <Text style={styles.status}>{riderTaskStatusLabel(assignment.status)}</Text>

      <Button label="View task" onPress={onViewTask} style={styles.action} />
      <Button label="Navigate" variant="outline" onPress={onNavigate} style={styles.action} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg, gap: spacing.xs },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.subheading, fontSize: 16 },
  row: { marginTop: spacing.sm },
  rowLabel: { ...typography.caption, color: colors.mutedForeground, textTransform: 'uppercase' },
  rowValue: { marginTop: 2, ...typography.bodySm, color: colors.foreground },
  step: {
    marginTop: spacing.sm,
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: '600',
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  metric: { flex: 1 },
  metricLabel: { ...typography.caption, color: colors.mutedForeground },
  metricValue: {
    marginTop: spacing.xs,
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  status: {
    marginTop: spacing.sm,
    ...typography.bodySm,
    color: colors.accentDark,
    textTransform: 'capitalize',
  },
  action: { marginTop: spacing.md },
});
