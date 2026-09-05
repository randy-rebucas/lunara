import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';

/** Soft radial accents matching customer-web `.laundry-bg` */
export function LaundryBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.base} />
      <View style={styles.blobPrimary} />
      <View style={styles.blobSecondary} />
      <View style={styles.blobAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surfaceMuted,
  },
  blobPrimary: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
    bottom: -60,
    left: -80,
  },
  blobSecondary: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    top: -40,
    right: -50,
  },
  blobAccent: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(34, 197, 94, 0.03)',
    top: '35%',
    alignSelf: 'center',
  },
});
