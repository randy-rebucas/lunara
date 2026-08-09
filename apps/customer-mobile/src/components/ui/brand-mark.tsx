import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { brandIconSource } from '../../lib/brand-icon';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const sizes = {
  sm: 36,
  md: 48,
  lg: 64,
};

export function BrandMark({ size = 'md', style }: BrandMarkProps) {
  const box = sizes[size];
  return (
    <View style={[styles.mark, { width: box, height: box }, style]}>
      <Image source={brandIconSource} style={{ width: box, height: box }} resizeMode="contain" accessibilityLabel="Brand" />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    overflow: 'hidden',
  },
});
