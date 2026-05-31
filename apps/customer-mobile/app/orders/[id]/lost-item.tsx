import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../../src/components/ui/button';
import { Card } from '../../../src/components/ui/card';
import { Input } from '../../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../../src/components/ui/keyboard-safe-scroll-view';
import { useAuthStore } from '../../../src/store/auth';
import { colors, spacing, typography } from '../../../src/theme';

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
      <Text style={styles.title}>Report a missing item</Text>
      <Text style={styles.sub}>
        We will open a support ticket and investigate with pickup/delivery photos and shop logs.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.label}>What is missing?</Text>
        <Input
          placeholder="e.g. White dress shirt, blue jeans"
          value={missingItems}
          onChangeText={setMissingItems}
        />
        <Text style={styles.hint}>Comma-separated list (optional)</Text>

        <Text style={[styles.label, styles.labelSpaced]}>Details</Text>
        <Input
          style={styles.textarea}
          placeholder="Describe what was in your order and when you noticed the item missing…"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={submitting ? 'Submitting…' : 'Submit complaint & create ticket'}
          onPress={handleSubmit}
          disabled={submitting}
        />
      </Card>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { ...typography.title, fontSize: 22 },
  sub: { ...typography.bodySm, marginTop: spacing.sm, marginBottom: spacing.lg },
  card: { gap: spacing.sm },
  label: { ...typography.label },
  labelSpaced: { marginTop: spacing.md },
  hint: { ...typography.caption, marginTop: -spacing.xs, marginBottom: spacing.sm },
  textarea: { minHeight: 120, paddingTop: spacing.md },
  error: { color: colors.destructive, fontSize: 14 },
});
