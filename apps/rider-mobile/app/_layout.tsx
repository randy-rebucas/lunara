import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthLoadingScreen } from '../src/components/auth-loading';
import { ForceUpdateScreen } from '../src/components/force-update-screen';
import { PushNotificationsBootstrap } from '../src/components/push-notifications-bootstrap';
import { RiderOperationsProvider } from '../src/context/rider-operations';
import { useAppVersionGate } from '../src/hooks/use-app-version-gate';
import { colors } from '../src/theme';
import { useAuthStore } from '../src/store/auth';

const stackHeaderOptions = {
  headerStyle: {
    backgroundColor: colors.surfaceMuted,
  },
  headerShadowVisible: false,
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: 17,
    color: colors.foreground,
  },
  headerTintColor: colors.primary,
  headerBackTitleVisible: false,
};

function isPublicRoute(segments: string[]): boolean {
  if (segments.length === 0) return true;
  if (segments[0] === 'index') return true;
  if (segments[0] === 'login') return true;
  if (segments[0] === 'forgot-password') return true;
  return false;
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);
  const tokens = useAuthStore((s) => s.tokens);
  const { checking: checkingVersion, updateRequired, storeUrl } = useAppVersionGate();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isLoading) return;
    const signedIn = Boolean(tokens?.accessToken);
    const publicRoute = isPublicRoute(segments as string[]);

    if (!signedIn && !publicRoute) {
      router.replace('/login');
      return;
    }
    if (signedIn && segments[0] === 'login') {
      router.replace('/(tabs)' as Href);
    }
  }, [isLoading, tokens, segments, router]);

  if (checkingVersion || isLoading) return <AuthLoadingScreen />;
  if (updateRequired) return <ForceUpdateScreen storeUrl={storeUrl} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RiderOperationsProvider>
        <PushNotificationsBootstrap />
        <Stack screenOptions={stackHeaderOptions}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, headerBackTitle: '' }} />
          <Stack.Screen name="pickup/[id]" options={{ title: 'Pickup task' }} />
          <Stack.Screen name="delivery/[id]" options={{ title: 'Delivery task' }} />
          <Stack.Screen name="earnings" options={{ title: 'My earnings' }} />
          <Stack.Screen name="wallet" options={{ title: 'Wallet' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="history" options={{ title: 'Task history' }} />
          <Stack.Screen name="performance" options={{ title: 'Performance' }} />
          <Stack.Screen name="support" options={{ title: 'Help & support' }} />
          <Stack.Screen name="profile/edit" options={{ title: 'Edit profile' }} />
          <Stack.Screen name="documents" options={{ title: 'Documents' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan QR', headerShown: false }} />
        </Stack>
      </RiderOperationsProvider>
    </SafeAreaProvider>
  );
}
