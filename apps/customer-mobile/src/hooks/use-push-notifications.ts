import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  notificationRouteToPath,
  resolveNotificationRoute,
} from '../lib/notification-types';
import {
  acquireDevicePushToken,
  isRemotePushSupported,
  Notifications,
  registerPushToken,
  unregisterPushToken,
} from '../lib/push-notifications';
import { useAuthStore } from '../store/auth';

function routeFromPushData(data: Record<string, unknown>): Href | null {
  const route = resolveNotificationRoute({
    _id: '',
    title: '',
    body: '',
    read: false,
    createdAt: '',
    data: {
      type: typeof data.type === 'string' ? data.type : undefined,
      orderId: typeof data.orderId === 'string' ? data.orderId : undefined,
      refundId: typeof data.refundId === 'string' ? data.refundId : undefined,
      status: typeof data.status === 'string' ? data.status : undefined,
    },
  });

  if (!route) return null;
  return notificationRouteToPath(route) as Href;
}

export function usePushNotifications() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const tokenRef = useRef<string | null>(null);

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

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as Record<string, unknown>;
        const href = routeFromPushData(data);
        if (href) router.push(href);
      })
      .catch(() => {});

    const onResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const href = routeFromPushData(data);
      if (href) router.push(href);
    });

    return () => onResponse.remove();
  }, [router]);
}
