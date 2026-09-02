import { useEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAppConfigStore } from '../src/store/app-config-store';
import { ThemeProvider } from '../src/theme/theme-provider';
import { ConfigProvider } from '../src/config/config-context';
import { isLightColor } from '../src/theme/color-luminance';

const PARTNER_SLUG = process.env.EXPO_PUBLIC_PARTNER_SLUG?.trim() || 'lunara-demo';

export default function RootLayout() {
  const { config, status, error, load } = useAppConfigStore();

  useEffect(() => {
    load(PARTNER_SLUG);
  }, [load]);

  if (!config && (status === 'idle' || status === 'loading')) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!config) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load app config{error ? `: ${error}` : ''}</Text>
        <Pressable style={styles.retryButton} onPress={() => load(PARTNER_SLUG)}>
          <Text style={styles.retryLabel}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider theme={config.theme}>
        <ConfigProvider value={config}>
          <StatusBar style={isLightColor(config.theme.background) ? 'dark' : 'light'} />
          <Stack screenOptions={{ headerShown: false }} />
        </ConfigProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  errorText: { textAlign: 'center' },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#2563eb' },
  retryLabel: { color: '#ffffff', fontWeight: '600' },
});
