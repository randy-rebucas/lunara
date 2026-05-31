import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, shadow } from '../../theme';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const sizes = {
  sm: { box: 36, text: 14, radius: radius.lg },
  md: { box: 48, text: 18, radius: radius.xl },
  lg: { box: 64, text: 24, radius: radius.xxl },
};

export function BrandMark({ size = 'md', style }: BrandMarkProps) {
  const s = sizes[size];
  return (
    <View
      style={[
        styles.mark,
        shadow.card,
        { width: s.box, height: s.box, borderRadius: s.radius },
        style,
      ]}
    >
      <Text style={[styles.letter, { fontSize: s.text }]}>L</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
