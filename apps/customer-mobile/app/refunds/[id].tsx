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
      <Text style={styles.status}>{formatRefundStatus(refund.status)}</Text>

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
              <Text style={styles.flowText}>
                {done ? '✓ ' : active ? '→ ' : '○ '}
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Card style={styles.detail}>
        <Text style={styles.detailTitle}>Your request</Text>
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
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>Timeline</Text>
          {refund.timeline.map((e, i) => (
            <Text key={i} style={styles.timelineItem}>
              {new Date(e.at).toLocaleString()} — {e.label}
              {e.note ? `: ${e.note}` : ''}
            </Text>
          ))}
        </View>
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
  status: { ...typography.bodySm, textTransform: 'capitalize', marginBottom: spacing.lg },
  flow: { gap: spacing.sm, marginBottom: spacing.lg },
  flowStep: {
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
  timeline: { marginBottom: spacing.xl, gap: spacing.xs },
  timelineTitle: { fontWeight: '600', marginBottom: spacing.sm },
  timelineItem: { ...typography.caption, color: colors.slate700 },
  btnSpaced: { marginTop: spacing.sm },
});
