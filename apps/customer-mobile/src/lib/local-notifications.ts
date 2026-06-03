import { orderEventTitle } from '@lunara/utils';
import { ORDER_EVENT_MESSAGES } from './order-events';
import { Notifications } from './push-notifications';

export interface DispatchNotificationPayload {
  orderId: string;
  event?: string;
  status?: string;
  message?: string;
  title?: string;
  body?: string;
}

export function dispatchNotificationCopy(payload: DispatchNotificationPayload) {
  const title =
    payload.title ??
    (payload.event ? orderEventTitle(payload.event) : 'Order update');
  const body =
    payload.body ??
    payload.message ??
    (payload.event ? ORDER_EVENT_MESSAGES[payload.event] : undefined) ??
    (payload.status ? `Status: ${payload.status.replace(/_/g, ' ')}` : 'Your order was updated.');
  return { title, body };
}

export async function presentDispatchNotification(payload: DispatchNotificationPayload) {
  const { title, body } = dispatchNotificationCopy(payload);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type: 'order_update',
        orderId: payload.orderId,
        ...(payload.event ? { event: payload.event } : {}),
        ...(payload.status ? { status: payload.status } : {}),
      },
      sound: true,
    },
    trigger: null,
  });
}
