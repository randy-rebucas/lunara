import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSosSession } from '../hooks/use-sos-session';
import { colors, radius, shadow, spacing, typography } from '../theme';
import { SosActionSheet } from './sos-action-sheet';

interface SosButtonProps {
  orderId: string;
  taskActive: boolean;
}

export function SosButton({ orderId, taskActive }: SosButtonProps) {
  const [open, setOpen] = useState(false);
  const session = useSosSession(orderId, taskActive);

  if (!taskActive) return null;

  function confirmNotify() {
    Alert.alert(
      'Notify dispatch?',
      'Operations will be alerted immediately that you need assistance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Notify',
          style: 'destructive',
          onPress: () => {
            void session.notifyDispatch();
          },
        },
      ],
    );
  }

  return (
    <>
      <View style={styles.wrap} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Emergency SOS"
        >
          <Text style={styles.fabText}>SOS</Text>
        </Pressable>
        {session.sharingActive ? (
          <View style={styles.pulse}>
            <Text style={styles.pulseText}>Live</Text>
          </View>
        ) : null}
      </View>

      <SosActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        loading={session.loading}
        sharingActive={session.sharingActive}
        dispatchNotified={session.dispatchNotified}
        onNotifyDispatch={confirmNotify}
        onToggleSharing={() => {
          if (session.sharingActive) {
            void session.stopSharing();
          } else {
            void session.startSharing();
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    zIndex: 20,
    alignItems: 'center',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.elevated,
  },
  fabPressed: {
    opacity: 0.9,
  },
  fabText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  pulse: {
    marginTop: spacing.xs,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pulseText: {
    ...typography.caption,
    color: '#B91C1C',
    fontWeight: '700',
  },
});
