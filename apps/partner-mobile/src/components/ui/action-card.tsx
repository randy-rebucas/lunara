import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './card';
import { colors, radius, spacing, typography } from '../../theme';

interface ActionCardProps extends PressableProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
}

export function ActionCard({ icon, title, hint, ...props }: ActionCardProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${hint}`} {...props}>
      <Card muted style={styles.inner}>
        <View style={styles.iconBadge}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { ...typography.subheading, fontSize: 15 },
  hint: { ...typography.caption, marginTop: 2 },
});
