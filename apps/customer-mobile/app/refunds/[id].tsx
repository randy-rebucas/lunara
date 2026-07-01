import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { REFUND_FLOW, formatRefundStatus, refundFlowIndex } from '@lunara/utils';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { DataLoadState } from '../../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

interface RefundDetail {
  _id: string;
  orderId: string;
  reason: string;
  status: string;
  stage: string;
  requestedAmount: number;
  approvedAmount?: number;
  rejectionReason?: string;
  processedAt?: string;
  timeline?: { stage: string; label: string; at: string; note?: string }[];
}

export default function RefundDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [refund, setRefund] = useState<RefundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const data = await apiFetch<{ refund: RefundDetail }>(`/refunds/${id}`);
      setRefund(data.refund);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load refund');
      setRefund(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || error || !refund) {
    return (
      <View style={styles.centered}>
        <DataLoadState
          loading={loading}
          error={error}
          loadingMessage="Loading refund…"
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      </View>
    );
  }

  const stageIdx = refundFlowIndex(refund.stage);

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
    >
      <View style={styles.statusPill}>
        <Ionicons name="cash-outline" size={13} color={colors.primary} />
        <Text style={styles.statusPillText}>{formatRefundStatus(refund.status)}</Text>
      </View>

      <View style={styles.flow}>
        {REFUND_FLOW.map((step, i) => {
          const done = i < stageIdx || refund.status === 'closed';
          const active = i === stageIdx && refund.status !== 'closed';
          return (
            <View
              key={step.id}
              style={[
                styles.flowStep,
                active && styles.flowStepActive,
                done && styles.flowStepDone,
              ]}
            >
              <Ionicons
                name={done ? 'checkmark-circle' : active ? 'ellipse' : 'ellipse-outline'}
                size={16}
                color={done ? colors.accent : active ? colors.primary : colors.mutedForeground}
              />
              <Text style={styles.flowText}>{step.label}</Text>
            </View>
          );
        })}
      </View>

      <Card style={styles.detail}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="document-text-outline" size={16} color={colors.primary} />
          <Text style={styles.detailTitle}>Your request</Text>
        </View>
        <Text style={styles.detailBody}>{refund.reason}</Text>
        <Text style={styles.detailMeta}>Requested: ₱{refund.requestedAmount}</Text>
        {refund.approvedAmount != null ? (
          <Text style={styles.approved}>Approved: ₱{refund.approvedAmount}</Text>
        ) : null}
        {refund.rejectionReason ? (
          <Text style={styles.rejected}>{refund.rejectionReason}</Text>
        ) : null}
        {refund.processedAt ? (
          <Text style={styles.processed}>Refund credited to your wallet.</Text>
        ) : null}
      </Card>

      {refund.timeline && refund.timeline.length > 0 ? (
        <Card style={styles.timeline}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={styles.timelineTitle}>Timeline</Text>
          </View>
          {refund.timeline.map((e, i) => (
            <View key={i} style={styles.timelineRow}>
              <Ionicons name="ellipse" size={6} color={colors.primary} style={styles.timelineDot} />
              <Text style={styles.timelineItem}>
                {new Date(e.at).toLocaleString()} — {e.label}
                {e.note ? `: ${e.note}` : ''}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Button label="View order" variant="outline" onPress={() => router.push(`/orders/${refund.orderId}`)} />
      <Button label="Wallet" variant="outline" onPress={() => router.push('/(tabs)/wallet')} style={styles.btnSpaced} />
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.lg,
  },
  statusPillText: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'capitalize' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flow: { gap: spacing.sm, marginBottom: spacing.lg },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  flowStepActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  flowStepDone: { borderColor: colors.accent + '33', backgroundColor: colors.accent + '11' },
  flowText: { fontSize: 14, color: colors.foreground },
  detail: { gap: spacing.sm, marginBottom: spacing.lg },
  detailTitle: { fontWeight: '600' },
  detailBody: { ...typography.bodySm, color: colors.slate700 },
  detailMeta: { ...typography.caption },
  approved: { color: colors.accent, fontWeight: '600' },
  rejected: { color: colors.destructive, marginTop: spacing.xs },
  processed: { color: colors.accentDark, marginTop: spacing.xs },
  timeline: { marginBottom: spacing.xl, gap: spacing.sm },
  timelineTitle: { fontWeight: '600' },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  timelineDot: { marginTop: 5 },
  timelineItem: { ...typography.caption, color: colors.slate700, flex: 1 },
  btnSpaced: { marginTop: spacing.sm },
});
