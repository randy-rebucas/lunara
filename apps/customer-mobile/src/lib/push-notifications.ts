import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { PushPlatform } from '@lunara/types';

/** FCM/APNs device tokens are unavailable in Expo Go since SDK 53 — use an EAS dev build.
 * Merely importing `expo-notifications` throws on Android in Expo Go, so every access to it
 * in this file goes through `loadNotifications()`, which never touches the module unless
 * this check has already passed. */
export function isRemotePushSupported(): boolean {
  if (!Device.isDevice) return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return true;
}

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;
let notificationHandlerReady = false;

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!isRemotePushSupported()) return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }
  if (!notificationHandlerReady) {
    notificationHandlerReady = true;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return notificationsModule;
}

async function ensureAndroidChannels(Notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Orders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function acquireDevicePushToken(): Promise<string | null> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return null;

    await ensureAndroidChannels(Notifications);

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

type NotificationResponse = Awaited<
  ReturnType<NotificationsModule['getLastNotificationResponseAsync']>
>;
type NotificationSubscription = ReturnType<NotificationsModule['addNotificationReceivedListener']>;

export async function getLastNotificationResponse(): Promise<NotificationResponse | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;
  return Notifications.getLastNotificationResponseAsync();
}

/** No-op subscription used when push isn't supported, so callers can always call `.remove()`. */
const noopSubscription = { remove() {} } as NotificationSubscription;

export function addNotificationResponseListener(
  callback: (response: NonNullable<NotificationResponse>) => void,
): NotificationSubscription {
  if (!isRemotePushSupported()) return noopSubscription;
  let subscription: NotificationSubscription = noopSubscription;
  let cancelled = false;
  void loadNotifications().then((Notifications) => {
    if (!Notifications || cancelled) return;
    subscription = Notifications.addNotificationResponseReceivedListener(callback);
  });
  return {
    remove() {
      cancelled = true;
      subscription.remove();
    },
  } as NotificationSubscription;
}

type ScheduleNotificationArgs = Parameters<NotificationsModule['scheduleNotificationAsync']>[0];

export async function scheduleNotification(args: ScheduleNotificationArgs): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync(args);
}

export function addNotificationReceivedListener(callback: () => void): NotificationSubscription {
  if (!isRemotePushSupported()) return noopSubscription;
  let subscription: NotificationSubscription = noopSubscription;
  let cancelled = false;
  void loadNotifications().then((Notifications) => {
    if (!Notifications || cancelled) return;
    subscription = Notifications.addNotificationReceivedListener(callback);
  });
  return {
    remove() {
      cancelled = true;
      subscription.remove();
    },
  } as NotificationSubscription;
}
