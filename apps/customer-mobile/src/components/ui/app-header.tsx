import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationBell } from '../notifications-preview';
import { brandName, colors, spacing, typography } from '../../theme';
import { BrandMark } from './brand-mark';

interface AppHeaderProps {
  subtitle?: string;
}

/** Branded tab header — mirrors rider-mobile's AppHeader (brand mark + wordmark + notification
 * bell) so the customer app reads as the same product family instead of a generic native-stack
 * title bar. `subtitle` carries the current tab's title (e.g. "Home", "Orders"). */
export function AppHeader({ subtitle }: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.brandRow}>
        <BrandMark size="sm" />
        <View style={styles.wordmarkBlock}>
          <Text style={styles.wordmark} numberOfLines={1}>
            {brandName.toUpperCase()}
          </Text>
          {subtitle ? (
            <Text style={styles.wordmarkSub} numberOfLines={1}>
              {subtitle.toUpperCase()}
            </Text>
          ) : null}
        </View>
      </View>

      <NotificationBell />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  wordmarkBlock: { flexShrink: 1 },
  wordmark: { ...typography.subheading, fontSize: 16, color: colors.primary, letterSpacing: 0.5 },
  wordmarkSub: { ...typography.label, fontSize: 10 },
});
