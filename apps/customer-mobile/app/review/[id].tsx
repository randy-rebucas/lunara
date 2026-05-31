import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { DataLoadState } from '../../src/components/data-load-state';
import { useAuthStore } from '../../src/store/auth';
import type { AppNotification } from '../../src/lib/notification-types';
import { colors, spacing, typography } from '../../src/theme';

interface ReviewData {
  _id: string;
  rating: number;
  comment?: string;
  publishedAt: string;
}

interface ReviewStatus {
  canReview: boolean;
  review: ReviewData | null;
  orderStatus: string;
}

export default function OrderReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);

  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState<ReviewData | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const data = await apiFetch<ReviewStatus>(`/reviews/orders/${id}`);
      setStatus(data);
      if (data.review) {
        setPublished(data.review);
        setRating(data.review.rating);
        setComment(data.review.comment ?? '');
      }

      const notifications = await apiFetch<AppNotification[]>('/notifications/me?limit=20');
      const unread = notifications.find((n: AppNotification) => !n.read && n.data?.orderId === id);
      if (unread) {
        await apiFetch(`/notifications/${unread._id}/read`, { method: 'PATCH' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load review');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (!id || rating < 1) {
      setError('Select a star rating before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await apiFetch<{ review: ReviewData }>('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          orderId: id,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      setPublished(result.review);
      setStatus((current) =>
        current ? { ...current, canReview: false, review: result.review } : current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  }

  const showForm = status?.canReview && !published;

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
      keyboardVerticalOffset={44}
    >
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <DataLoadState
        loading={loading}
        error={error && !status ? error : ''}
        loadingMessage="Loading review…"
        onRetry={load}
      />

      {!loading && status ? (
        <>
          <Text style={styles.title}>Rate your laundry</Text>
          <Text style={styles.sub}>
            Your feedback helps Lunara improve service and partner quality.
          </Text>

          <Card style={styles.card}>
            <Text style={styles.label}>Your rating</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => showForm && setRating(value)}
                  disabled={!showForm}
                  hitSlop={8}
                >
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={value <= rating ? '#F59E0B' : colors.mutedForeground}
                  />
                </Pressable>
              ))}
            </View>

            {showForm ? (
              <>
                <Input
                  style={styles.comment}
                  placeholder="Share more about your experience (optional)"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                {error ? <Text style={styles.inlineError}>{error}</Text> : null}
                <Button
                  label={submitting ? 'Submitting…' : 'Submit review'}
                  onPress={handleSubmit}
                  disabled={submitting || rating < 1}
                />
              </>
            ) : published ? (
              <>
                <Text style={styles.thanks}>Thank you for your review!</Text>
                {published.comment ? (
                  <Text style={styles.publishedComment}>{published.comment}</Text>
                ) : null}
                <Button label="Back to order" variant="outline" onPress={() => router.replace(`/orders/${id}`)} />
              </>
            ) : (
              <Text style={styles.muted}>Reviews are available after your order is completed.</Text>
            )}
          </Card>
        </>
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  backLink: { marginBottom: spacing.lg },
  backText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  title: { ...typography.title, fontSize: 22 },
  sub: { ...typography.bodySm, marginTop: spacing.xs, marginBottom: spacing.xl },
  card: { gap: spacing.md },
  label: { ...typography.label },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  comment: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  inlineError: { color: colors.destructive, fontSize: 14 },
  thanks: { fontSize: 16, fontWeight: '600', color: colors.accentDark, textAlign: 'center' },
  publishedComment: { ...typography.bodySm, textAlign: 'center' },
  muted: { ...typography.bodySm, textAlign: 'center' },
});
