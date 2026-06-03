import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from '../api-config';
import { useAuthStore } from '../store/auth';
import {
  presentRiderAssignmentNotification,
  presentRiderDispatchNotification,
  presentRiderOfferNotification,
  presentRiderOrderUpdateNotification,
} from '../lib/local-notifications';
import type {
  DispatchAssignmentPayload,
  DispatchOfferPayload,
  OrderRealtimePayload,
  RiderNotificationPayload,
} from '../lib/dispatch-events';

export type {
  DispatchOfferPayload,
  DispatchAssignmentPayload,
  RiderNotificationPayload,
  OrderRealtimePayload,
} from '../lib/dispatch-events';

export interface RiderDispatchSocketHandlers {
  onRefresh: () => void;
  onNotificationsSync: () => void;
  onOrderUpdate?: (payload: OrderRealtimePayload) => void;
  onSocket?: (socket: Socket | null) => void;
}

export function useRiderDispatchSocket(
  accessToken: string | null | undefined,
  userId: string | null | undefined,
  isOnline: boolean,
  taskOrderIds: string[],
  handlers: RiderDispatchSocketHandlers,
) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  const isOnlineRef = useRef(isOnline);
  const taskOrderIdsRef = useRef(taskOrderIds);
  const socketRef = useRef<Socket | null>(null);
  const joinedOrdersRef = useRef(new Set<string>());

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    taskOrderIdsRef.current = taskOrderIds;
  }, [taskOrderIds]);

  useEffect(() => {
    if (!accessToken) {
      handlersRef.current.onSocket?.(null);
      return;
    }

    const socket = io(`${getApiOrigin()}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });
    socketRef.current = socket;
    handlersRef.current.onSocket?.(socket);

    const refresh = () => handlersRef.current.onRefresh();
    const syncNotifications = () => handlersRef.current.onNotificationsSync();

    const joinTaskOrders = () => {
      for (const orderId of taskOrderIdsRef.current) {
        if (joinedOrdersRef.current.has(orderId)) continue;
        socket.emit('joinOrder', { orderId });
        joinedOrdersRef.current.add(orderId);
      }
    };

    socket.on('connect', () => {
      if (userId) socket.emit('joinRider', { userId });
      if (isOnlineRef.current) socket.emit('joinRiders');
      joinTaskOrders();
      setConnected(true);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('pickupOffer', (payload: DispatchOfferPayload) => {
      refresh();
      void presentRiderOfferNotification(payload, 'pickup').catch(() => {});
    });

    socket.on('deliveryOffer', (payload: DispatchOfferPayload) => {
      refresh();
      if (isOnlineRef.current) {
        void presentRiderOfferNotification(payload, 'delivery').catch(() => {});
      }
    });

    socket.on('pickupAssignment', (payload: DispatchAssignmentPayload) => {
      refresh();
      syncNotifications();
      void presentRiderAssignmentNotification(payload).catch(() => {});
    });

    socket.on('deliveryAssignment', (payload: DispatchAssignmentPayload) => {
      refresh();
      syncNotifications();
      void presentRiderAssignmentNotification(payload).catch(() => {});
    });

    socket.on('riderNotification', (payload: RiderNotificationPayload) => {
      syncNotifications();
      refresh();
      void presentRiderDispatchNotification(payload).catch(() => {});
    });

    socket.on('orderStatusUpdate', (payload: OrderRealtimePayload) => {
      handlersRef.current.onOrderUpdate?.(payload);
      refresh();
      void presentRiderOrderUpdateNotification(payload).catch(() => {});
    });

    socket.on('orderEvent', (payload: OrderRealtimePayload) => {
      handlersRef.current.onOrderUpdate?.(payload);
      refresh();
      if (payload.message || payload.event) {
        void presentRiderOrderUpdateNotification(payload).catch(() => {});
      }
    });

    return () => {
      joinedOrdersRef.current.clear();
      socket.disconnect();
      setConnected(false);
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      handlersRef.current.onSocket?.(null);
    };
  }, [accessToken, userId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    if (isOnline) {
      socket.emit('joinRiders');
    } else {
      socket.emit('leaveRiders');
    }
  }, [isOnline]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    for (const orderId of taskOrderIds) {
      if (joinedOrdersRef.current.has(orderId)) continue;
      socket.emit('joinOrder', { orderId });
      joinedOrdersRef.current.add(orderId);
    }
  }, [taskOrderIds]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        handlersRef.current.onRefresh();
        handlersRef.current.onNotificationsSync();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, []);

  return { connected };
}

export function useRiderOrderSocket(orderId: string | undefined, onUpdate: () => void) {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);

  useEffect(() => {
    if (!accessToken || !orderId) return;

    const socket = io(`${getApiOrigin()}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    socket.on('connect', () => {
      socket.emit('joinOrder', { orderId });
    });

    const refresh = () => onUpdate();
    socket.on('orderStatusUpdate', refresh);
    socket.on('orderEvent', refresh);

    return () => {
      socket.disconnect();
    };
  }, [accessToken, orderId, onUpdate]);
}
