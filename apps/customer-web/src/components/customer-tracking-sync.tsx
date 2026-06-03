'use client';

import { useEffect, useRef } from 'react';
import { resolveApiOrigin } from '@lunara/utils';
import { io, type Socket } from 'socket.io-client';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { isActiveOrderStatus } from '@lunara/utils';

/** Keeps customer tracking socket alive and refreshes notification UI on dispatch events. */
export function CustomerTrackingSync() {
  const { api, tokens, isAuthenticated } = useAuthContext();
  const joinedOrdersRef = useRef(new Set<string>());

  useEffect(() => {
    const token = tokens?.accessToken;
    if (!isAuthenticated || !token) return;

    const socket: Socket = io(`${resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL)}/tracking`, {
      transports: ['websocket'],
      auth: { token },
    });

    const bumpNotifications = () => {
      window.dispatchEvent(new CustomEvent('lunara-notifications-bump'));
    };

    const joinActiveOrders = async () => {
      try {
        const res = await api.get<{ items: { _id: string; status: string }[] }>('/orders?limit=50');
        for (const order of res.data.items) {
          if (!isActiveOrderStatus(order.status)) continue;
          if (joinedOrdersRef.current.has(order._id)) continue;
          socket.emit('joinOrder', { orderId: order._id });
          joinedOrdersRef.current.add(order._id);
        }
      } catch {
        // customer room still receives events
      }
    };

    const onDispatchUpdate = () => {
      bumpNotifications();
    };

    socket.on('connect', () => {
      socket.emit('joinCustomer');
      void joinActiveOrders();
    });

    socket.on('orderStatusUpdate', onDispatchUpdate);
    socket.on('orderEvent', onDispatchUpdate);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void joinActiveOrders();
        bumpNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      joinedOrdersRef.current.clear();
      socket.disconnect();
    };
  }, [api, isAuthenticated, tokens?.accessToken]);

  return null;
}
