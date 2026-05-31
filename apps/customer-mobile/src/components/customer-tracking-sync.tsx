import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from '../api-config';
import { ORDER_EVENT_MESSAGES } from '../lib/order-events';
import { useAuthStore } from '../store/auth';
import { useOrderRealtimeStore } from '../store/order-realtime';

/** Keeps one customer tracking socket alive while signed in. */
export function CustomerTrackingSync() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const notify = useOrderRealtimeStore((s) => s.notify);

  useEffect(() => {
    if (!accessToken) return;

    const apiUrl = getApiOrigin();
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    socket.on('connect', () => {
      socket.emit('joinCustomer');
    });

    socket.on('orderStatusUpdate', (data: { orderId: string; status: string }) => {
      notify({ orderId: data.orderId, status: data.status });
    });

    socket.on('orderEvent', (data: { orderId: string; event: string; message?: string }) => {
      notify({
        orderId: data.orderId,
        event: data.event,
        message: data.message ?? ORDER_EVENT_MESSAGES[data.event],
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, notify]);

  return null;
}
