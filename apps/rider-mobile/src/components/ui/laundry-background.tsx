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
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(79, 70, 229, 0.04)',
    bottom: -80,
    left: -90,
  },
  blobSecondary: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
    top: -50,
    right: -60,
  },
  blobAccent: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(34, 197, 94, 0.025)',
    top: '38%',
    alignSelf: 'center',
  },
});
