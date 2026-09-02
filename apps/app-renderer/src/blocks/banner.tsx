import { View, Text, StyleSheet } from 'react-native';
import type { BannerProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

const TONE_COLOR: Record<BannerProps['tone'], 'accent' | 'primary' | 'destructive'> = {
  info: 'accent',
  success: 'primary',
  warning: 'destructive',
};

export function Banner({ message, tone }: BannerProps) {
  const theme = useTheme();
  const backgroundColor = theme[TONE_COLOR[tone]];
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.message, { color: theme.background }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 8, marginBottom: 16 },
  message: { fontSize: 14, fontWeight: '500' },
});
