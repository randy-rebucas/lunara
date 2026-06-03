import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  acquireDevicePushToken,
  isRemotePushSupported,
  Notifications,
  registerPushToken,
  unregisterPushToken,
} from '../lib/push-notifications';
import { resolveRiderNotificationRoute } from '../lib/notification-types';
import { useRiderOperations } from '../context/rider-operations';
import { useAuthStore } from '../store/auth';

function routeFromPushData(data: Record<string, unknown>): Href | null {
  const route = resolveRiderNotificationRoute({
    _id: '',
    title: '',
    body: '',
    read: false,
    createdAt: '',
    data: {
      category: typeof data.category === 'string' ? (data.category as never) : undefined,
      type: typeof data.type === 'string' ? data.type : undefined,
      orderId: typeof data.orderId === 'string' ? data.orderId : undefined,
      status: typeof data.status === 'string' ? data.status : undefined,
    },
  });

  if (!route) return null;
  if (route.kind === 'earnings') return '/earnings';
  return route.kind === 'delivery' ? (`/delivery/${route.orderId}` as Href) : (`/pickup/${route.orderId}` as Href);
}

export function usePushNotifications() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const tokenRef = useRef<string | null>(null);
  const refresh = useRiderOperations().refresh;

  useEffect(() => {
    if (!accessToken) {
      const previous = tokenRef.current;
      tokenRef.current = null;
      if (previous) {
        void unregisterPushToken(apiFetch, previous).catch(() => {});
      }
      return;
    }

    if (!isRemotePushSupported()) return;

    let cancelled = false;

    void (async () => {
      const deviceToken = await acquireDevicePushToken();
      if (cancelled || !deviceToken) return;
      tokenRef.current = deviceToken;
      await registerPushToken(apiFetch, deviceToken);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [accessToken, apiFetch]);

  useEffect(() => {
    if (!isRemotePushSupported()) return;

    const onResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const href = routeFromPushData(data);
      if (href) router.push(href);
    });

    const onReceived = Notifications.addNotificationReceivedListener(() => {
      refresh();
    });

    return () => {
      onResponse.remove();
      onReceived.remove();
    };
  }, [router, refresh]);
}
