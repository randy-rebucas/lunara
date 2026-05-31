import { useEffect } from 'react';

import { Stack, useRouter, useSegments } from 'expo-router';

import { StatusBar } from 'expo-status-bar';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthLoadingScreen } from '../src/components/auth-loading';

import { CustomerTrackingSync } from '../src/components/customer-tracking-sync';

import { PushNotificationsBootstrap } from '../src/components/push-notifications-bootstrap';

import {

  fetchOnboardingStatus,

  getOnboardingPath,

  redirectAfterAuth,

} from '../src/lib/onboarding';

import { useAuthStore } from '../src/store/auth';

import { colors } from '../src/theme';



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

  if (segments[0] === '(auth)') return true;

  return false;

}



function isOnboardingRoute(segments: string[]): boolean {

  return segments[0] === 'onboarding';

}



export default function RootLayout() {

  const router = useRouter();

  const segments = useSegments();

  const hydrate = useAuthStore((s) => s.hydrate);

  const isLoading = useAuthStore((s) => s.isLoading);

  const tokens = useAuthStore((s) => s.tokens);

  const apiFetch = useAuthStore((s) => s.apiFetch);



  useEffect(() => {

    hydrate();

  }, [hydrate]);



  useEffect(() => {

    if (isLoading) return;

    const signedIn = Boolean(tokens?.accessToken);

    const segs = segments as string[];

    const publicRoute = isPublicRoute(segs);

    const onboardingRoute = isOnboardingRoute(segs);



    if (!signedIn && !publicRoute && !onboardingRoute) {

      router.replace('/(auth)/login');

      return;

    }



    if (signedIn && segs[0] === '(auth)') {

      void redirectAfterAuth(apiFetch, router);

      return;

    }



    if (signedIn && !publicRoute && !onboardingRoute) {

      let cancelled = false;

      fetchOnboardingStatus(apiFetch).then((status) => {

        if (cancelled || status.isComplete) return;

        router.replace(getOnboardingPath(status));

      });

      return () => {

        cancelled = true;

      };

    }

  }, [isLoading, tokens, segments, router, apiFetch]);



  if (isLoading) {

    return (

      <SafeAreaProvider>

        <StatusBar style="dark" />

        <AuthLoadingScreen />

      </SafeAreaProvider>

    );

  }



  return (

    <SafeAreaProvider>

      <StatusBar style="dark" />

      {tokens?.accessToken ? <CustomerTrackingSync /> : null}

      {tokens?.accessToken ? <PushNotificationsBootstrap /> : null}

      <Stack screenOptions={{ headerShown: false }}>

        <Stack.Screen name="index" />

        <Stack.Screen name="(auth)/login" />

        <Stack.Screen name="(auth)/signup" />

        <Stack.Screen name="onboarding/profile" />

        <Stack.Screen name="onboarding/address" />

        <Stack.Screen name="(tabs)" />

        <Stack.Screen

          name="book"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Book laundry',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="checkout/[orderId]/index"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Checkout',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="checkout/[orderId]/success"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Payment',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="orders/[id]"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Track order',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="orders/[id]/refund"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Request refund',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="orders/[id]/lost-item"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Report missing item',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="refunds/index"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Refunds',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="refunds/[id]"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Refund request',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="support/index"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Support',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="support/[id]"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Support ticket',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="notifications"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Notifications',

            presentation: 'card',

          }}

        />

        <Stack.Screen

          name="review/[id]"

          options={{

            ...stackHeaderOptions,

            headerShown: true,

            title: 'Leave a review',

            presentation: 'card',

          }}

        />

      </Stack>

    </SafeAreaProvider>

  );

}

