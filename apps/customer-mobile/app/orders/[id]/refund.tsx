import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaymentMethod } from '@lunara/types';
import { formatCashTimingLabel, formatCurrency, isRefundablePaymentMethod } from '@lunara/utils';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { Input } from '../../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../../src/components/ui/keyboard-safe-scroll-view';
import { DataLoadState } from '../../../src/components/data-load-state';
import { useAuthStore } from '../../../src/store/auth';
import { colors, radius, spacing, typography } from '../../../src/theme';

export default function RequestRefundScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [reason, setReason] = useState('');
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [cashBlocked, setCashBlocked] = useState(false);
  const [cashLabel, setCashLabel] = useState('');
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch<{
      order: { total: number };
      payment: { method: string; cashTiming?: 'pickup' | 'delivery' } | null;
    }>(`/payments/orders/${id}`)
      .then((res) => {
        setOrderTotal(res.order?.total ?? null);
        const payment = res.payment;
        if (
          !payment ||
          payment.method === PaymentMethod.CASH ||
          !isRefundablePaymentMethod(payment.method as PaymentMethod)
        ) {
          setCashBlocked(true);
          if (payment?.method === PaymentMethod.CASH) {
            setCashLabel(formatCashTimingLabel(payment.cashTiming));
          }
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [apiFetch, id]);

  async function handleSubmit() {
    if (cashBlocked) return;
    if (!id || reason.trim().length < 10) {
      setError('Please explain your refund request (at least 10 characters).');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await apiFetch<{ _id: string }>('/refunds', {
        method: 'POST',
        body: JSON.stringify({ orderId: id, reason: reason.trim() }),
      });
      router.replace(`/refunds/${result._id}` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
      keyboardVerticalOffset={44}
    >
      <DataLoadState loading={loading} error={loadError} loadingMessage="Loading order…" />

      {!loading && !loadError ? (
        <>
          {/* Hero row */}
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="cash-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.title}>Request a refund</Text>
              <Text style={styles.sub}>
                Submit your request for admin review. Approved refunds are credited to your wallet.
              </Text>
            </View>
          </View>

          {/* Order total pill */}
          {orderTotal != null ? (
            <Card style={styles.totalCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                <Text style={styles.totalLabel}>Order total</Text>
              </View>
              <Text style={styles.totalAmount}>{formatCurrency(orderTotal)}</Text>
              <Text style={styles.totalHint}>
                Approved refunds are credited to your Lunara Wallet.
              </Text>
            </Card>
          ) : null}

          {cashBlocked ? (
            <Card style={styles.blockedCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.blockedTitle}>Not eligible for a wallet refund</Text>
              </View>
              <Text style={styles.blockedText}>
                {cashLabel
                  ? `This order uses ${cashLabel.toLowerCase()} and cannot be refunded to your wallet. Contact support if you need help.`
                  : 'This order is not eligible for a wallet refund. Only wallet and online payments qualify.'}
              </Text>
            </Card>
          ) : (
            <>
              {/* Form card */}
              <Card style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={styles.cardTitle}>Your reason</Text>
                </View>

                <Text style={styles.label}>Reason for refund</Text>
                <Input
                  style={styles.textarea}
                  placeholder="Explain why you are requesting a refund…"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{reason.trim().length} / 10 min characters</Text>

                {error ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}
              </Card>

              <Button
                label={submitting ? 'Submitting…' : 'Submit refund request'}
                onPress={handleSubmit}
                disabled={submitting}
              />
            </>
          )}

          {!cashBlocked ? (
            <View style={styles.noteRow}>
              <Ionicons name="time-outline" size={13} color={colors.muted} />
              <Text style={styles.note}>
                Our team reviews refund requests within 1–3 business days.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },

  /* Hero */
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroText: { flex: 1 },
  title: { ...typography.title, fontSize: 20 },
  sub: { ...typography.bodySm, color: colors.slate700, marginTop: spacing.xs },

  /* Total card */
  totalCard: { gap: spacing.xs },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  totalLabel: { fontWeight: '600', fontSize: 14, color: colors.foreground },
  totalAmount: { fontSize: 28, fontWeight: '800', color: colors.primary },
  totalHint: { ...typography.caption, color: colors.muted },

  /* Cash-blocked notice */
  blockedCard: { gap: spacing.sm, backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
  blockedTitle: { fontWeight: '600', fontSize: 14, color: colors.warning },
  blockedText: { ...typography.bodySm, color: colors.warning, lineHeight: 20 },

  /* Form card */
  card: { gap: spacing.sm },
  cardTitle: { fontWeight: '600', fontSize: 15, color: colors.foreground },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted },
  textarea: { minHeight: 120, paddingTop: spacing.md },
  charCount: { ...typography.caption, color: colors.muted, textAlign: 'right', marginTop: -spacing.xs },

  /* Error */
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  error: { color: colors.destructive, fontSize: 13, flex: 1 },

  /* Footer note */
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  note: { ...typography.caption, color: colors.muted, flex: 1 },
});
