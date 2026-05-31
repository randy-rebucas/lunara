import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaymentCheckout } from '../../../src/components/payment-checkout';
import { KeyboardSafeScrollView } from '../../../src/components/ui/keyboard-safe-scroll-view';
import { colors, spacing, typography } from '../../../src/theme';

export default function CheckoutScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const handlePaid = useCallback(
    (paymentId: string) => {
      router.replace(`/checkout/${orderId}/success?paymentId=${paymentId}` as Href);
    },
    [orderId, router],
  );

  if (!orderId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Order not found</Text>
      </View>
    );
  }

  return (
    <KeyboardSafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      useTopSafeInset={false}
    >
      <Text style={styles.sub}>Choose how you want to pay for this order</Text>
      <PaymentCheckout orderId={orderId} onPaid={handlePaid} />
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sub: { ...typography.bodySm, marginBottom: spacing.lg },
  error: { color: colors.destructive },
});
