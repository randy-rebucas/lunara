import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, radius, spacing, typography } from '../theme';

interface HandoffQrData {
  label: string;
  payload: string;
}

interface HandoffQrCardProps {
  orderId: string;
  context: 'pickup' | 'delivery';
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

export function HandoffQrCard({ orderId, context, apiFetch }: HandoffQrCardProps) {
  const [data, setData] = useState<HandoffQrData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<HandoffQrData>(
        `/orders/${orderId}/handoff-qr?context=${context}`,
      );
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, context, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{data.label}</Text>
      <Text style={styles.hint}>
        {context === 'pickup'
          ? 'Show this code when your rider arrives for pickup.'
          : 'Show this code when your rider delivers your laundry.'}
      </Text>
      <View style={styles.qrWrap}>
        <QRCode value={data.payload} size={200} backgroundColor="#fff" color={colors.foreground} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  title: { ...typography.subheading, textAlign: 'center' },
  hint: {
    marginTop: spacing.sm,
    ...typography.bodySm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  qrWrap: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#fff',
  },
});
