import { usePushNotifications } from '../hooks/use-push-notifications';

/** Registers device push token and notification tap handlers when signed in. */
export function PushNotificationsBootstrap() {
  usePushNotifications();
  return null;
}
