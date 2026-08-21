import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthLoadingScreen } from '../src/components/auth-loading';
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
  headerBackTitle: 'Back',
};

function isPublicRoute(segments: string[]): boolean {
  if (segments.length === 0) return true;
  if (segments[0] === 'index') return true;
  if (segments[0] === 'login') return true;
  return false;
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);
  const tokens = useAuthStore((s) => s.tokens);

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

  if (isLoading) return <AuthLoadingScreen />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={stackHeaderOptions}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="order/[id]/index" options={{ title: 'Order' }} />
        <Stack.Screen name="order/[id]/receiving" options={{ title: 'Shop receiving' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
