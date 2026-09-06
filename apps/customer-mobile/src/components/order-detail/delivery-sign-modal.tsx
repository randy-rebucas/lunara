import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { colors, radius, spacing } from '../../theme';
import { toErrorMessage } from '../../lib/api-error';

interface DeliverySignModalProps {
  visible: boolean;
  accountName: string;
  /** Performs the actual `POST /orders/:id/delivery/sign` call. */
  onSign: (signatureName: string) => Promise<void>;
  /** Called after a successful sign. */
  onSigned: () => void;
}

/** "Sign for delivery" form, extracted from `orders/[id]/index.tsx` — owns its own signature-name
 * input + submitting/error state, only talking to the parent screen via `onSign`. This modal has
 * no dismiss action (matches the original `onRequestClose={() => {}}` — delivery must be signed
 * for before the flow continues). */
export function DeliverySignModal({ visible, accountName, onSign, onSigned }: DeliverySignModalProps) {
  const [signatureName, setSignatureName] = useState('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  async function handleSign(nameOverride?: string) {
    if (signing) return;
    const name = (nameOverride ?? signatureName).trim();
    if (name.length < 2) {
      setError('Enter your name (min 2 characters) to sign.');
      return;
    }
    setError('');
    setSigning(true);
    try {
      await onSign(name);
      setSignatureName('');
      onSigned();
    } catch (e) {
      setError(toErrorMessage(e, 'Sign failed'));
    } finally {
      setSigning(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <View style={styles.sheetOverlay}>
        <View style={styles.sheetPanel}>
          <View style={styles.sheetHandle} />
          <View style={styles.cardHeaderRow}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={styles.actionTitle}>Sign for delivery</Text>
          </View>
          <Input
            style={styles.input}
            placeholder="Your name"
            value={signatureName}
            onChangeText={setSignatureName}
          />

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={signing ? 'Signing…' : 'Sign'}
            onPress={() => handleSign()}
            disabled={signing}
            style={styles.actionBtn}
          />

          {accountName ? (
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>Or</Text>
              <View style={styles.orLine} />
            </View>
          ) : null}

          {accountName ? (
            <Pressable
              style={styles.tapToSignRow}
              onPress={() => handleSign(accountName)}
              disabled={signing}
              accessibilityRole="button"
              accessibilityLabel={`Tap to sign as ${accountName}`}
            >
              <Ionicons name="finger-print-outline" size={16} color={colors.primary} />
              <Text style={styles.tapToSignText}>Just click to sign as {accountName}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheetPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionTitle: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  input: { marginTop: spacing.md },
  actionBtn: { marginTop: spacing.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  error: { color: colors.destructive, fontSize: 13 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground },
  tapToSignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  tapToSignText: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
