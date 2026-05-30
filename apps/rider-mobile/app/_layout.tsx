import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth';

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
    const onLogin = segments[0] === 'login';
    if (!tokens?.accessToken && !onLogin) router.replace('/login');
    if (tokens?.accessToken && onLogin) router.replace('/');
  }, [isLoading, tokens, segments, router]);

  if (isLoading) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ title: 'Operations' }} />
        <Stack.Screen name="pickup/[id]" options={{ title: 'Pickup' }} />
        <Stack.Screen name="delivery/[id]" options={{ title: 'Delivery' }} />
        <Stack.Screen name="earnings" options={{ title: 'Earnings' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      </Stack>
    </>
  );
}
