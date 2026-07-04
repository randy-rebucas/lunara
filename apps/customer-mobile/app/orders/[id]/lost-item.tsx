import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { Input } from '../../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../../src/store/auth';
import { colors, radius, spacing, typography } from '../../../src/theme';

export default function ReportLostItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [description, setDescription] = useState('');
  const [missingItems, setMissingItems] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!id || description.trim().length < 10) {
      setError('Please describe the missing item (at least 10 characters).');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await apiFetch<{ _id: string }>('/support/lost-items', {
        method: 'POST',
        body: JSON.stringify({
          orderId: id,
          description: description.trim(),
          missingItems: missingItems
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      router.replace(`/support/${result._id}` as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit report');
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
      {/* Hero icon + heading */}
      <View style={styles.heroRow}>
        <View style={styles.heroIcon}>
          <Ionicons name="help-buoy-outline" size={28} color={colors.primary} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.title}>Report a missing item</Text>
          <Text style={styles.sub}>
            We&apos;ll open a support ticket and investigate with pickup/delivery photos and shop logs.
          </Text>
        </View>
      </View>

      {/* Info banner */}
      <Card style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.infoText}>
          Submitting this form creates a case. Our team typically responds within 24 hours.
        </Text>
      </Card>

      {/* Form card */}
      <Card style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="list-outline" size={16} color={colors.primary} />
          <Text style={styles.cardTitle}>Item details</Text>
        </View>

        <Text style={styles.label}>What is missing?</Text>
        <Input
          placeholder="e.g. White dress shirt, blue jeans"
          value={missingItems}
          onChangeText={setMissingItems}
          style={styles.field}
        />
        <View style={styles.hintRow}>
          <Ionicons name="ellipsis-horizontal-outline" size={11} color={colors.muted} />
          <Text style={styles.hint}>Comma-separated list (optional)</Text>
        </View>

        <Text style={[styles.label, styles.labelSpaced]}>Description</Text>
        <Input
          style={styles.textarea}
          placeholder="Describe what was in your order and when you noticed the item missing…"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.trim().length} / 10 min characters</Text>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
      </Card>

      {/* Submit */}
      <Button
        label={submitting ? 'Submitting…' : 'Submit & create ticket'}
        onPress={handleSubmit}
        disabled={submitting}
        style={styles.submitBtn}
      />

      {/* Disclaimer */}
      <View style={styles.disclaimerRow}>
        <Ionicons name="shield-checkmark-outline" size={13} color={colors.muted} />
        <Text style={styles.disclaimer}>
          Providing false reports may affect your account standing.
        </Text>
      </View>
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

  /* Info banner */
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderWidth: 0,
  },
  infoText: { ...typography.bodySm, color: colors.slate700, flex: 1 },

  /* Form card */
  card: { gap: spacing.sm },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontWeight: '600', fontSize: 15, color: colors.foreground },
  label: { fontSize: 12, fontWeight: '600', color: colors.muted },
  labelSpaced: { marginTop: spacing.sm },
  field: { marginBottom: 0 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.xs },
  hint: { ...typography.caption, color: colors.muted },
  textarea: { minHeight: 120, paddingTop: spacing.md },
  charCount: {
    ...typography.caption,
    color: colors.muted,
    textAlign: 'right',
    marginTop: -spacing.xs,
  },

  /* Error */
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  error: { color: colors.destructive, fontSize: 13, flex: 1 },

  /* Footer */
  submitBtn: {},
  disclaimerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  disclaimer: { ...typography.caption, color: colors.muted, flex: 1 },
});
