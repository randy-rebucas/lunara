import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '@lunara/utils';
import { theme } from '@lunara/config';
import { DataLoadState } from '../../src/components/data-load-state';
import { useAuthStore } from '../../src/store/auth';

export default function WalletScreen() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiFetch<{ balance: number }>('/wallets/me');
      setBalance(data.balance);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function topUp() {
    setTopUpLoading(true);
    try {
      const data = await apiFetch<{ balance: number }>('/wallets/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: 500 }),
      });
      setBalance(data.balance);
      Alert.alert('Wallet topped up', formatCurrency(500));
    } catch (e) {
      Alert.alert('Top up failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setTopUpLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <DataLoadState
        loading={loading}
        error={error}
        loadingMessage="Loading wallet…"
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />
      {!loading && !error ? (
        <>
          <Text style={styles.balance}>{formatCurrency(balance)}</Text>
          <Text style={styles.label}>Wallet balance</Text>
          <Pressable style={styles.button} onPress={topUp} disabled={topUpLoading}>
            <Text style={styles.buttonText}>
              {topUpLoading ? 'Processing…' : 'Top up ₱500'}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  balance: { fontSize: 40, fontWeight: '700', color: theme.colors.primary },
  label: { marginTop: 8, color: '#64748b' },
  button: {
    marginTop: 24,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
