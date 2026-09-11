import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { RiderCompliance } from '../lib/rider-types';
import { Card } from './ui/card';
import { colors, spacing, typography } from '../theme';

interface ComplianceBannerProps {
  compliance?: RiderCompliance | null;
}

export function ComplianceBanner({ compliance }: ComplianceBannerProps) {
  const router = useRouter();
  if (!compliance || compliance.isCompliant) return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Complete your profile to go online</Text>
      <Text style={styles.body}>{compliance.profileGaps.length} profile field(s) missing.</Text>
      <Text style={styles.gaps} numberOfLines={3}>
        {compliance.profileGaps.join(' · ')}
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={() => router.push('/profile/edit')} style={styles.linkBtn}>
          <Text style={styles.linkText}>Edit profile</Text>
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
