import {
  dispatchAssignmentAlert,
  dispatchNotificationAlert,
  dispatchOfferAlert,
  type DispatchAssignmentPayload,
  type DispatchOfferPayload,
  type RiderNotificationPayload,
} from './dispatch-events';
import { Notifications } from './push-notifications';

export async function presentRiderOfferNotification(
  payload: DispatchOfferPayload,
  kind: 'pickup' | 'delivery',
) {
  const { title, body } = dispatchOfferAlert(payload, kind);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type: kind === 'pickup' ? 'pickup_offer' : 'delivery_offer',
        orderId: payload.orderId ?? payload._id ?? '',
        category: 'assignment',
      },
      sound: true,
    },
    trigger: null,
  });
}

export async function presentRiderAssignmentNotification(payload: DispatchAssignmentPayload) {
  const { title, body } = dispatchAssignmentAlert(payload);
  const isDelivery = payload.type === 'delivery_assignment';
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type: isDelivery ? 'delivery_assignment' : 'pickup_assignment',
        orderId: payload.orderId ?? '',
        category: 'assignment',
      },
      sound: true,
    },
    trigger: null,
  });
}

export async function presentRiderDispatchNotification(payload: RiderNotificationPayload) {
  const { title, body } = dispatchNotificationAlert(payload);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type: payload.type ?? 'dispatch_update',
        orderId: payload.orderId ?? '',
        category: 'system',
      },
      sound: true,
    },
    trigger: null,
  });
}

export async function presentRiderOrderUpdateNotification(payload: {
  orderId: string;
  status?: string;
  event?: string;
  message?: string;
}) {
  const title = payload.event ? 'Order update' : 'Dispatch update';
  const body =
    payload.message ??
    (payload.status ? `Order status: ${payload.status.replace(/_/g, ' ')}` : 'Task list updated.');
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type: 'order_update',
        orderId: payload.orderId,
        ...(payload.status ? { status: payload.status } : {}),
      },
      sound: true,
    },
    trigger: null,
  });
}
