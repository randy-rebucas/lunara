import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { RIDER_DOCUMENT_TYPES, type RiderCompliance } from '../lib/rider-types';
import { Card } from './ui/card';
import { colors, spacing, typography } from '../theme';

interface ComplianceBannerProps {
  compliance?: RiderCompliance | null;
}

export function ComplianceBanner({ compliance }: ComplianceBannerProps) {
  const router = useRouter();
  if (!compliance || compliance.isCompliant) return null;

  const totalDocs = RIDER_DOCUMENT_TYPES.length;
  const approved = compliance.approvedDocumentCount;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Complete verification to go online</Text>
      <Text style={styles.body}>
        {compliance.profileGaps.length > 0
          ? `${compliance.profileGaps.length} profile field(s) missing. `
          : 'Profile complete. '}
        {approved} of {totalDocs} documents approved.
      </Text>
      {compliance.documentGaps.length > 0 ? (
        <Text style={styles.gaps} numberOfLines={3}>
          {compliance.documentGaps.join(' · ')}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {compliance.profileGaps.length > 0 ? (
          <Pressable onPress={() => router.push('/profile/edit')} style={styles.linkBtn}>
            <Text style={styles.linkText}>Edit profile</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push('/documents')} style={styles.linkBtn}>
          <Text style={styles.linkText}>Documents</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderColor: colors.warningBorder,
    borderWidth: 1,
  },
  title: { ...typography.subheading, fontSize: 16 },
  body: { ...typography.bodySm },
  gaps: { ...typography.caption, color: colors.mutedForeground },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  linkBtn: { paddingVertical: spacing.xs },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});
