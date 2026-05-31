import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LOST_ITEM_FLOW, formatLostItemOutcome, lostItemFlowIndex } from '@lunara/utils';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { DataLoadState } from '../../src/components/data-load-state';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../src/store/auth';
import { colors, radius, spacing, typography } from '../../src/theme';

interface Ticket {
  _id: string;
  subject: string;
  description: string;
  status: string;
  type: string;
  orderId?: string;
  missingItems?: string[];
  outcome?: string;
  compensationAmount?: number;
  compensationCreditedAt?: string;
  timeline?: { stage: string; label: string; at: string; note?: string }[];
}

export default function SupportTicketScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [currentStage, setCurrentStage] = useState('complaint');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const data = await apiFetch<{
        ticket: Ticket;
        investigation: { currentStage: string } | null;
      }>(`/support/tickets/${id}`);
      setTicket(data.ticket);
      setCurrentStage(data.investigation?.currentStage ?? 'complaint');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ticket');
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || error || !ticket) {
    return (
      <View style={styles.centered}>
        <DataLoadState
          loading={loading}
          error={error}
          loadingMessage="Loading ticket…"
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      </View>
    );
  }

  const stageIdx = lostItemFlowIndex(currentStage);

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
    >
      <Text style={styles.status}>Status: {ticket.status.replace(/_/g, ' ')}</Text>

      {ticket.type === 'lost_item' ? (
        <>
          <View style={styles.flow}>
            {LOST_ITEM_FLOW.map((step, i) => {
              const done = i < stageIdx || ticket.status === 'closed';
              const active = i === stageIdx && ticket.status !== 'closed';
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

          {ticket.outcome && ticket.outcome !== 'pending' ? (
            <Card style={styles.outcome}>
              <Text style={styles.outcomeTitle}>
                Outcome: {formatLostItemOutcome(ticket.outcome)}
              </Text>
              {(ticket.compensationAmount ?? 0) > 0 ? (
                <Text style={styles.outcomeMeta}>
                  Compensation: ₱{ticket.compensationAmount}
                  {ticket.compensationCreditedAt ? ' (credited to wallet)' : ''}
                </Text>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}

      <Card style={styles.detail}>
        <Text style={styles.detailTitle}>Your report</Text>
        <Text style={styles.detailBody}>{ticket.description}</Text>
        {ticket.missingItems && ticket.missingItems.length > 0 ? (
          <Text style={styles.detailMeta}>Items: {ticket.missingItems.join(', ')}</Text>
        ) : null}
      </Card>

      {ticket.timeline && ticket.timeline.length > 0 ? (
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>Updates</Text>
          {ticket.timeline.map((e, i) => (
            <Text key={i} style={styles.timelineItem}>
              {new Date(e.at).toLocaleString()} — {e.label}
              {e.note ? `: ${e.note}` : ''}
            </Text>
          ))}
        </View>
      ) : null}

      <Button label="All tickets" variant="outline" onPress={() => router.push('/support' as Href)} />
      {ticket.orderId ? (
        <Button
          label="View order"
          variant="outline"
          onPress={() => router.push(`/orders/${ticket.orderId}`)}
          style={styles.btnSpaced}
        />
      ) : null}
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
  flowText: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  outcome: { marginBottom: spacing.lg, backgroundColor: colors.accent + '11' },
  outcomeTitle: { fontWeight: '600', color: colors.accentDark },
  outcomeMeta: { ...typography.bodySm, marginTop: spacing.xs },
  detail: { gap: spacing.sm, marginBottom: spacing.lg },
  detailTitle: { fontWeight: '600' },
  detailBody: { ...typography.bodySm, color: colors.slate700 },
  detailMeta: { ...typography.caption },
  timeline: { marginBottom: spacing.xl, gap: spacing.xs },
  timelineTitle: { fontWeight: '600', marginBottom: spacing.sm },
  timelineItem: { ...typography.caption, color: colors.slate700 },
  btnSpaced: { marginTop: spacing.sm },
});
