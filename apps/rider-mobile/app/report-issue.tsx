import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/ui/button';
import { Card } from '../src/components/ui/card';
import { Input } from '../src/components/ui/input';
import { Screen } from '../src/components/ui/screen';
import { useAuthStore } from '../src/store/auth';
import { colors, radius, spacing, typography } from '../src/theme';

type IssueType = 'damaged_item' | 'delivery_delay' | 'other';

const ISSUE_TYPES: { id: IssueType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'damaged_item', label: 'Damaged item', icon: 'alert-circle-outline' },
  { id: 'delivery_delay', label: 'Delivery delay', icon: 'time-outline' },
  { id: 'other', label: 'Other issue', icon: 'chatbubble-ellipses-outline' },
];

export default function ReportIssueScreen() {
  const router = useRouter();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [issueType, setIssueType] = useState<IssueType>('damaged_item');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = subject.trim().length >= 3 && description.trim().length >= 10;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/support/rider-issues', {
        method: 'POST',
        body: JSON.stringify({
          issueType,
          subject: subject.trim(),
          description: description.trim(),
        }),
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit report');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Screen inStack>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
          </View>
          <Text style={styles.successTitle}>Report submitted</Text>
          <Text style={styles.successText}>
            Dispatch has been notified and will follow up if needed.
          </Text>
          <Button label="Done" onPress={() => router.back()} style={styles.doneBtn} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen inStack scroll>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Report an issue</Text>
        <Text style={styles.pageSubtitle}>
          Let dispatch know about a damaged item, delivery delay, or anything else — this is
          tracked separately from emergency SOS.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>ISSUE TYPE</Text>
      <View style={styles.typeRow}>
        {ISSUE_TYPES.map((t) => {
          const selected = issueType === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setIssueType(t.id)}
              style={[styles.typeChip, selected && styles.typeChipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Ionicons name={t.icon} size={16} color={selected ? colors.onPrimary : colors.primary} />
              <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>DETAILS</Text>
      <Card style={styles.formCard}>
        <Text style={styles.fieldLabel}>Subject</Text>
        <Input
          value={subject}
          onChangeText={setSubject}
          placeholder="Brief summary"
          maxLength={120}
        />
        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>What happened?</Text>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what happened (at least 10 characters)"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.textarea}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={submitting ? 'Submitting…' : 'Submit report'}
          onPress={handleSubmit}
          disabled={submitting || !canSubmit}
          style={styles.submitBtn}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: spacing.xl },
  pageTitle: { fontSize: 24, fontWeight: '800', color: colors.foreground, letterSpacing: -0.3 },
  pageSubtitle: { ...typography.bodySm, marginTop: spacing.xs },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  typeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  typeChipTextSelected: { color: colors.onPrimary },
  formCard: { gap: spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: spacing.xs },
  fieldLabelSpaced: { marginTop: spacing.md },
  textarea: { minHeight: 100 },
  error: { color: colors.destructive, fontSize: 13, marginTop: spacing.sm },
  submitBtn: { marginTop: spacing.lg },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  successIcon: { marginBottom: spacing.lg },
  successTitle: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  successText: {
    ...typography.bodySm,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  doneBtn: { minWidth: 160 },
});
