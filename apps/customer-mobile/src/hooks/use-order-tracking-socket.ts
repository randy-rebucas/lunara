import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from '../api-config';
import { ORDER_EVENT_MESSAGES } from '../lib/order-events';
import { useAuthStore } from '../store/auth';

interface OrderTrackingHandlers {
  onStatusUpdate?: (data: { orderId: string; status: string }) => void;
  onOrderEvent?: (data: { orderId: string; event: string; message?: string }) => void;
  onLocationUpdate?: (data: { lat: number; lng: number }) => void;
}

/** Subscribe to live updates for a single order (joins on connect). */
export function useOrderTrackingSocket(
  orderId: string | undefined,
  handlers: OrderTrackingHandlers,
) {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!orderId || !accessToken) return;

    const apiUrl = getApiOrigin();
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    socket.on('connect', () => {
      socket.emit('joinCustomer');
      socket.emit('joinOrder', { orderId });
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('orderStatusUpdate', (data: { orderId: string; status: string }) => {
      if (data.orderId !== orderId) return;
      handlersRef.current.onStatusUpdate?.(data);
    });

    socket.on('orderEvent', (data: { orderId: string; event: string; message?: string }) => {
      if (data.orderId !== orderId) return;
      handlersRef.current.onOrderEvent?.({
        ...data,
        message: data.message ?? ORDER_EVENT_MESSAGES[data.event],
      });
    });

    socket.on('locationUpdate', (data: { lat: number; lng: number }) => {
      handlersRef.current.onLocationUpdate?.(data);
    });

    return () => {
      setConnected(false);
      socket.disconnect();
    };
  }, [orderId, accessToken]);

  return { connected };
}
