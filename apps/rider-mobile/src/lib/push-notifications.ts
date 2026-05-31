import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { PushPlatform } from '@lunara/types';

/** FCM/APNs device tokens are unavailable in Expo Go since SDK 53 — use an EAS dev build. */
export function isRemotePushSupported(): boolean {
  if (!Device.isDevice) return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
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
  await Notifications.setNotificationChannelAsync('offers', {
    name: 'Job offers',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync('assignments', {
    name: 'Assignments',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('earnings', {
    name: 'Earnings',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('system', {
    name: 'System',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Orders',
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
