import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui/button';
import { colors, radius, spacing, typography } from '../theme';

interface SosActionSheetProps {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  sharingActive: boolean;
  dispatchNotified: boolean;
  onNotifyDispatch: () => void;
  onToggleSharing: () => void;
}

export function SosActionSheet({
  visible,
  onClose,
  loading,
  sharingActive,
  dispatchNotified,
  onNotifyDispatch,
  onToggleSharing,
}: SosActionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Emergency SOS</Text>
          <Text style={styles.subtitle}>
            Use only when you need immediate assistance during an active task.
          </Text>

          <Button
            label={dispatchNotified ? 'Dispatch notified ✓' : 'Notify Dispatch'}
            disabled={loading || dispatchNotified}
            onPress={onNotifyDispatch}
            style={styles.action}
          />

          <Button
            label={sharingActive ? 'Stop sharing live location' : 'Share live location'}
            variant={sharingActive ? 'outline' : 'secondary'}
            disabled={loading}
            onPress={onToggleSharing}
            style={styles.action}
          />

          {sharingActive ? (
            <View style={styles.sharingChip}>
              <Text style={styles.sharingText}>Sharing location with dispatch</Text>
            </View>
          ) : null}

          <Button label="Close" variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.heading,
    color: '#B91C1C',
  },
  subtitle: {
    ...typography.bodySm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  action: {
    marginBottom: spacing.md,
  },
  sharingChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  sharingText: {
    ...typography.bodySm,
    color: '#B91C1C',
    fontWeight: '600',
  },
});
