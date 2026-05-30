import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth';

function isPublicRoute(segments: string[]): boolean {
  if (segments.length === 0) return true;
  if (segments[0] === 'index') return true;
  if (segments[0] === '(auth)') return true;
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
      router.replace('/(auth)/login');
      return;
    }
    if (signedIn && segments[0] === '(auth)') {
      router.replace('/(tabs)');
    }
  }, [isLoading, tokens, segments, router]);

  if (isLoading) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="book"
          options={{ headerShown: true, title: 'Book laundry', presentation: 'card' }}
        />
        <Stack.Screen
          name="orders/[id]"
          options={{ headerShown: true, title: 'Track order', presentation: 'card' }}
        />
      </Stack>
    </>
  );
}
