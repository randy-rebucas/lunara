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
import { brandName, colors, radius, spacing, typography } from '../../src/theme';

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

const STAR_COLOR = colors.star;

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

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
      <DataLoadState
        loading={loading}
        error={error && !status ? error : ''}
        loadingMessage="Loading review…"
        onRetry={load}
      />

      {!loading && status ? (
        <>
          {/* Hero */}
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="star-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.title}>Rate your laundry</Text>
              <Text style={styles.sub}>
                Your feedback helps {brandName} improve service and partner quality.
              </Text>
            </View>
          </View>

          {/* Rating card */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="ribbon-outline" size={16} color={colors.primary} />
              <Text style={styles.cardTitle}>Your rating</Text>
            </View>

            {/* Stars */}
            <View style={styles.starsWrap}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => showForm && setRating(value)}
                    disabled={!showForm}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${value} star${value > 1 ? 's' : ''}`}
                    accessibilityState={{ selected: value === rating }}
                  >
                    <Ionicons
                      name={value <= rating ? 'star' : 'star-outline'}
                      size={40}
                      color={value <= rating ? STAR_COLOR : colors.border}
                    />
                  </Pressable>
                ))}
              </View>
              {rating > 0 ? (
                <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
              ) : (
                <Text style={styles.ratingPlaceholder}>Tap a star to rate</Text>
              )}
            </View>

            {showForm ? (
              <>
                <View style={styles.commentWrap}>
                  <Text style={styles.commentLabel}>Comments <Text style={styles.optional}>(optional)</Text></Text>
                  <Input
                    style={styles.comment}
                    placeholder="Share more about your experience…"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                {error ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}

                <Button
                  label={submitting ? 'Submitting…' : 'Submit review'}
                  onPress={handleSubmit}
                  disabled={submitting || rating < 1}
                />
              </>
            ) : published ? (
              <>
                {/* Published state */}
                <View style={styles.thanksBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  <Text style={styles.thanks}>Thank you for your review!</Text>
                </View>
                {published.comment ? (
                  <Card style={styles.publishedCard}>
                    <View style={styles.cardHeaderRow}>
                      <Ionicons name="chatbubble-outline" size={14} color={colors.muted} />
                      <Text style={styles.publishedCommentLabel}>Your comment</Text>
                    </View>
                    <Text style={styles.publishedComment}>{published.comment}</Text>
                  </Card>
                ) : null}
                <Button
                  label="Back to order"
                  variant="outline"
                  onPress={() => router.replace(`/orders/${id}`)}
                />
              </>
            ) : (
              <View style={styles.lockedRow}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />
                <Text style={styles.muted}>
                  Reviews are available after your order is completed.
                </Text>
              </View>
            )}
          </Card>

          {/* Footer note */}
          {showForm ? (
            <View style={styles.noteRow}>
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.muted} />
              <Text style={styles.note}>
                Reviews are public and help other customers choose the right service.
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

  /* Card */
  card: { gap: spacing.lg },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontWeight: '600', fontSize: 15, color: colors.foreground },

  /* Stars */
  starsWrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  stars: { flexDirection: 'row', gap: spacing.sm },
  ratingLabel: { fontSize: 15, fontWeight: '700', color: STAR_COLOR },
  ratingPlaceholder: { ...typography.bodySm, color: colors.muted },

  /* Comment */
  commentWrap: { gap: spacing.xs },
  commentLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  optional: { fontWeight: '400' },
  comment: { minHeight: 100, paddingTop: spacing.md },

  /* Error */
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  error: { color: colors.destructive, fontSize: 13, flex: 1 },

  /* Published state */
  thanksBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent + '15',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  thanks: { fontSize: 15, fontWeight: '700', color: colors.accentDark },
  publishedCard: { gap: spacing.sm, backgroundColor: colors.surfaceMuted },
  publishedCommentLabel: { ...typography.caption, fontWeight: '600', color: colors.muted },
  publishedComment: { ...typography.bodySm, color: colors.slate700 },

  /* Locked */
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  muted: { ...typography.bodySm, color: colors.muted, flex: 1 },

  /* Footer */
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  note: { ...typography.caption, color: colors.muted, flex: 1 },
});
