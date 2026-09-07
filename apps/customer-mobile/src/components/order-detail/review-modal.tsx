import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { colors, radius, spacing } from '../../theme';
import { toErrorMessage } from '../../lib/api-error';

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  /** Performs the actual `POST /reviews` call — rejects with a message-bearing `Error` on failure. */
  onSubmit: (rating: number, comment: string) => Promise<void>;
  /** Called after a successful submit, once the modal has already closed itself. */
  onSubmitted: () => void;
}

/** Star-rating + comment review form, extracted from `orders/[id]/index.tsx` — owns its own
 * rating/comment/submitting/error state, only talking to the parent screen via `onSubmit`. */
export function ReviewModal({ visible, onClose, onSubmit, onSubmitted }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleClose() {
    setRating(0);
    setComment('');
    setError('');
    onClose();
  }

  async function handleSubmit() {
    if (rating < 1) {
      setError('Select a star rating before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(rating, comment.trim());
      setRating(0);
      setComment('');
      onSubmitted();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not submit review'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={handleClose} />
        <View style={styles.sheetPanel}>
          <View style={styles.sheetHandle} />
          <View style={styles.cardHeaderRow}>
            <Ionicons name="star-outline" size={18} color={colors.primary} />
            <Text style={styles.actionTitle}>Rate your experience</Text>
          </View>

          <View style={styles.starsWrap}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRating(value)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} star${value > 1 ? 's' : ''}`}
                  accessibilityState={{ selected: value === rating }}
                >
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={value <= rating ? colors.star : colors.border}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <Input
            style={styles.input}
            placeholder="Comments (optional)"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

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
            style={styles.actionBtn}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheetBackdrop: { flex: 1 },
  sheetPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionTitle: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  starsWrap: { alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  starsRow: { flexDirection: 'row', gap: spacing.sm },
  input: { marginTop: spacing.md },
  actionBtn: { marginTop: spacing.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  error: { color: colors.destructive, fontSize: 13 },
});
