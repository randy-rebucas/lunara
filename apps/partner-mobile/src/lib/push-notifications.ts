import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { PushPlatform } from '@lunara/types';

type NotificationsModule = typeof import('expo-notifications');

/**
 * `expo-notifications` throws at import time on Android inside Expo Go (its
 * auto-registration side effect calls a push API that SDK 53 removed from
 * Expo Go). Load it lazily and fall back to a no-op stub there so the rest of
 * the app keeps working. Mirrors apps/rider-mobile/src/lib/push-notifications.ts.
 */
const Notifications: NotificationsModule = (() => {
  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    return new Proxy({} as NotificationsModule, {
      get: () =>
        () =>
          Promise.resolve(undefined),
    });
  }
  try {
    return require('expo-notifications');
  } catch {
    return new Proxy({} as NotificationsModule, {
      get: () =>
        () =>
          Promise.resolve(undefined),
    });
  }
})();

/** FCM/APNs device tokens are unavailable in Expo Go since SDK 53 — use an EAS dev build. */
export function isRemotePushSupported(): boolean {
  if (!Device.isDevice) return false;
  if (isRunningInExpoGo()) return false;
  return true;
}

if (isRemotePushSupported()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('incoming', {
    name: 'Incoming orders',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync('staff', {
    name: 'Staff assignments',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('system', {
    name: 'System',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function acquireDevicePushToken(): Promise<string | null> {
  if (!isRemotePushSupported()) return null;

  try {
    await ensureAndroidChannels();

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    const token = await Notifications.getDevicePushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

export function getPushPlatform(): PushPlatform {
  return Platform.OS === 'ios' ? PushPlatform.IOS : PushPlatform.ANDROID;
}

export async function registerPushToken(
  apiFetch: (path: string, init?: RequestInit) => Promise<unknown>,
  token: string,
) {
  await apiFetch('/users/me/push-token', {
    method: 'POST',
    body: JSON.stringify({
      token,
      platform: getPushPlatform(),
    }),
  });
}

export async function unregisterPushToken(
  apiFetch: (path: string, init?: RequestInit) => Promise<unknown>,
  token: string,
) {
  await apiFetch('/users/me/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

export { Notifications };
