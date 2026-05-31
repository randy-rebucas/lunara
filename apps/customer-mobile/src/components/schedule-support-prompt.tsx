import { Ionicons } from '@expo/vector-icons';
import { appConfig } from '@lunara/config';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { useAuthStore } from '../store/auth';
import { colors, radius, spacing, typography } from '../theme';

interface ScheduleSupportAddress {
  _id: string;
  label: string;
  line1: string;
  city: string;
  province: string;
  postalCode: string;
}

interface ScheduleSupportPromptProps {
  address?: ScheduleSupportAddress | null;
  reason?: string;
}

export function ScheduleSupportPrompt({ address, reason }: ScheduleSupportPromptProps) {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!address) return null;

  const addressSummary = `${address.label} · ${address.line1}, ${address.city}`;

  async function submitRequest() {
    setSubmitting(true);
    try {
      const result = await apiFetch<{ _id: string; subject: string }>('/support/area-requests', {
        method: 'POST',
        body: JSON.stringify({
          addressId: address!._id,
          message: message.trim() || undefined,
        }),
      });
      setModalOpen(false);
      setMessage('');
      Alert.alert(
        'Request sent',
        `Our team will review pickup options for your area and follow up soon.\n\nTicket: ${result.subject}`,
      );
    } catch (e) {
      Alert.alert(
        'Could not send request',
        e instanceof Error ? e.message : 'Try again or email support.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function emailSupport() {
    const subject = encodeURIComponent(`Pickup not available — ${address!.city}`);
    const body = encodeURIComponent(
      [
        'Hi Lunara support,',
        '',
        'I could not schedule a pickup for my address:',
        `${address!.line1}, ${address!.city}, ${address!.province} ${address!.postalCode}`,
        reason ? `\nApp message: ${reason}` : '',
        message.trim() ? `\nMy note: ${message.trim()}` : '',
        '',
        'Please let me know when pickup is available in my area.',
      ].join('\n'),
    );
    Linking.openURL(`mailto:${appConfig.supportEmail}?subject=${subject}&body=${body}`);
  }

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="help-buoy-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Need pickup in your area?</Text>
            <Text style={styles.body}>
              Lunara is expanding across Metro Manila. Tell us where you are and we will follow up
              when pickup is available.
            </Text>
            <Text style={styles.address}>{addressSummary}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Button label="Contact support" onPress={() => setModalOpen(true)} style={styles.btn} />
          <Button label="Email support" variant="outline" onPress={emailSupport} style={styles.btn} />
        </View>
      </Card>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Request pickup in your area</Text>
            <Text style={styles.sheetSub}>
              We will share your address with the Lunara team and contact you about coverage.
            </Text>
            <Text style={styles.sheetAddress}>{addressSummary}</Text>
            <Input
              placeholder="Optional note (e.g. village, landmark, preferred time)"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={styles.noteInput}
            />
            <Button
              label={submitting ? 'Sending…' : 'Send request'}
              onPress={submitRequest}
              disabled={submitting}
            />
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setModalOpen(false)}
              style={styles.cancelBtn}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.secondaryLight,
    borderColor: colors.secondary,
  },
  header: { flexDirection: 'row', gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  body: { ...typography.bodySm, marginTop: spacing.xs },
  address: { ...typography.caption, marginTop: spacing.sm, fontWeight: '600' },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  btn: { width: '100%' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  sheetTitle: { ...typography.subheading, fontSize: 18 },
  sheetSub: { ...typography.bodySm, marginTop: spacing.sm, marginBottom: spacing.md },
  sheetAddress: { ...typography.caption, fontWeight: '600', marginBottom: spacing.lg },
  noteInput: { minHeight: 88, paddingTop: spacing.md, marginBottom: spacing.lg },
  cancelBtn: { marginTop: spacing.sm },
});
