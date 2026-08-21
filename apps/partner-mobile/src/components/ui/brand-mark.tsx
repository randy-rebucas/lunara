import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import brandIcon from '@lunara/brand/assets/icon.png';
import { radius, shadow } from '../../theme';

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
    <View
      style={[
        styles.mark,
        shadow.card,
        { width: box, height: box, borderRadius: size === 'lg' ? radius.xxl : radius.xl },
        style,
      ]}
    >
      <Image source={brandIcon} style={{ width: box, height: box }} resizeMode="contain" accessibilityLabel="Lunara" />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
