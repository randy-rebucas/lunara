import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme';

export interface BranchVariant {
  branchId: string;
  name: string;
  isMainShop: boolean;
  distanceLabel: string;
}

interface BranchPickerSheetProps {
  visible: boolean;
  shopName: string;
  branches: BranchVariant[];
  selectedBranchId: string;
  onSelect: (branchId: string) => void;
  onClose: () => void;
}

export function BranchPickerSheet({
  visible,
  shopName,
  branches,
  selectedBranchId,
  onSelect,
  onClose,
}: BranchPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 300,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close branch picker" />
      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] }]}
      >
        <View style={styles.handle} />
        <Text style={typography.subheading}>{shopName} branches</Text>
        <Text style={[typography.bodySm, { marginTop: spacing.xs }]}>
          Pick which branch you&apos;d like this order picked up from.
        </Text>
        <View style={{ marginTop: spacing.md }}>
          {branches.map((b) => {
            const selected = b.branchId === selectedBranchId;
            return (
              <Pressable
                key={b.branchId}
                style={({ pressed }) => [
                  styles.row,
                  selected && styles.rowSelected,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => onSelect(b.branchId)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTitleWrap}>
                    <Text style={typography.body}>{b.name}</Text>
                    {b.isMainShop ? (
                      <View style={styles.mainTag}>
                        <Text style={styles.mainTagText}>Main</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={typography.caption}>{b.distanceLabel}</Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.mutedForeground,
    opacity: 0.4,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mainTag: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  mainTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
});
