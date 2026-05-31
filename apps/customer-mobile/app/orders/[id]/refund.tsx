import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { Input } from '../../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../../src/components/ui/keyboard-safe-scroll-view';
import { DataLoadState } from '../../../src/components/data-load-state';
import { useAuthStore } from '../../../src/store/auth';
import { colors, spacing, typography } from '../../../src/theme';

export default function RequestRefundScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [reason, setReason] = useState('');
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ order: { total: number } }>(`/payments/orders/${id}`)
      .then((res) => setOrderTotal(res.order?.total ?? null))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [apiFetch, id]);

  async function handleSubmit() {
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
          <Text style={styles.title}>Request a refund</Text>
          <Text style={styles.sub}>
            Submit your request for admin review. Approved refunds are credited to your wallet.
          </Text>
          {orderTotal != null ? (
            <Text style={styles.total}>Order total: ₱{orderTotal}</Text>
          ) : null}

          <Card style={styles.card}>
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
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={submitting ? 'Submitting…' : 'Submit refund request'}
              onPress={handleSubmit}
              disabled={submitting}
            />
          </Card>
        </>
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { ...typography.title, fontSize: 22 },
  sub: { ...typography.bodySm, marginTop: spacing.sm, marginBottom: spacing.lg },
  total: { fontSize: 14, fontWeight: '600', marginBottom: spacing.lg },
  card: { gap: spacing.md },
  label: { ...typography.label },
  textarea: { minHeight: 120, paddingTop: spacing.md },
  error: { color: colors.destructive, fontSize: 14 },
});
