import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from '../api-config';
import { isActiveOrderStatus } from '../lib/active-order';
import { presentDispatchNotification } from '../lib/local-notifications';
import { ORDER_EVENT_MESSAGES } from '../lib/order-events';
import { useAuthStore } from '../store/auth';
import { useNotificationSyncStore } from '../store/notification-sync';
import { useOrderRealtimeStore } from '../store/order-realtime';

/** Keeps customer tracking socket alive; surfaces dispatch events as local + inbox notifications. */
export function CustomerTrackingSync() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const notify = useOrderRealtimeStore((s) => s.notify);
  const bumpNotifications = useNotificationSyncStore((s) => s.bump);
  const joinedOrdersRef = useRef(new Set<string>());

  useEffect(() => {
    if (!accessToken) return;

    const apiUrl = getApiOrigin();
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    const joinActiveOrders = async () => {
      try {
        const data = await apiFetch<{ items: { _id: string; status: string }[] }>('/orders');
        for (const order of data.items) {
          if (!isActiveOrderStatus(order.status)) continue;
          if (joinedOrdersRef.current.has(order._id)) continue;
          socket.emit('joinOrder', { orderId: order._id });
          joinedOrdersRef.current.add(order._id);
        }
      } catch {
        // ignore — customer room still receives events
      }
    };

    const onDispatchUpdate = async (data: {
      orderId: string;
      status?: string;
      event?: string;
      message?: string;
    }) => {
      notify({
        orderId: data.orderId,
        status: data.status,
        event: data.event,
        message: data.message ?? (data.event ? ORDER_EVENT_MESSAGES[data.event] : undefined),
      });
      bumpNotifications();

      try {
        await presentDispatchNotification({
          orderId: data.orderId,
          status: data.status,
          event: data.event,
          message: data.message,
        });
      } catch {
        // local notifications unavailable (e.g. Expo Go)
      }
    };

    socket.on('connect', () => {
      socket.emit('joinCustomer');
      void joinActiveOrders();
    });

    socket.on('orderStatusUpdate', (data: { orderId: string; status: string }) => {
      void onDispatchUpdate(data);
    });

    socket.on('orderEvent', (data: { orderId: string; event: string; message?: string }) => {
      void onDispatchUpdate(data);
    });

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void joinActiveOrders();
        bumpNotifications();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      sub.remove();
      joinedOrdersRef.current.clear();
      socket.disconnect();
    };
  }, [accessToken, apiFetch, notify, bumpNotifications]);

  return null;
}
