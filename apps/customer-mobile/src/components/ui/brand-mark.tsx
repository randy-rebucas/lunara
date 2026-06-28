import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { useBrand } from '../../brand/BrandContext';

const defaultIcon = require('../../../assets/logo.png');

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
  const { logoUrl, displayName } = useBrand();
  const box = sizes[size];
  const source = logoUrl ? { uri: logoUrl } : defaultIcon;
  return (
    <View style={[styles.mark, { width: box, height: box }, style]}>
      <Image source={source} style={{ width: box, height: box }} resizeMode="contain" accessibilityLabel={displayName} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    overflow: 'hidden',
  },
});
