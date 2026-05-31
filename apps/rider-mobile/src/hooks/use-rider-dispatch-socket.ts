import { useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { getApiOrigin } from '../api-config';
import {
  dispatchAssignmentAlert,
  dispatchNotificationAlert,
  dispatchOfferAlert,
  type DispatchAssignmentPayload,
  type DispatchOfferPayload,
  type OrderRealtimePayload,
  type RiderNotificationPayload,
} from '../lib/dispatch-events';
import { useAuthStore } from '../store/auth';

export interface RiderDispatchSocketHandlers {
  onRefresh: () => void;
  onNotificationsSync: () => void;
  onOrderUpdate?: (payload: OrderRealtimePayload) => void;
  /** Expose socket for location emits during active tasks. */
  onSocket?: (socket: Socket | null) => void;
}

/**
 * Keeps one dispatch socket while signed in.
 * - Personal room (`joinRider`): assignments + notifications
 * - Online pool (`joinRiders`): broadcast pickup/delivery offers
 * - Order rooms: live task status for active jobs
 */
export function useRiderDispatchSocket(
  accessToken: string | null | undefined,
  userId: string | null | undefined,
  isOnline: boolean,
  taskOrderIds: string[],
  handlers: RiderDispatchSocketHandlers,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const joinedOrdersRef = useRef<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const isOnlineRef = useRef(isOnline);
  const taskOrderIdsRef = useRef(taskOrderIds);

  isOnlineRef.current = isOnline;
  taskOrderIdsRef.current = taskOrderIds;

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
    });

    socket.on('pickupOffer', (payload: DispatchOfferPayload) => {
      refresh();
      const alert = dispatchOfferAlert(payload, 'pickup');
      Alert.alert(alert.title, alert.body);
    });

    socket.on('deliveryOffer', (payload: DispatchOfferPayload) => {
      refresh();
      if (isOnlineRef.current) {
        const alert = dispatchOfferAlert(payload, 'delivery');
        Alert.alert(alert.title, alert.body);
      }
    });

    socket.on('pickupAssignment', (payload: DispatchAssignmentPayload) => {
      refresh();
      syncNotifications();
      const alert = dispatchAssignmentAlert(payload);
      Alert.alert(alert.title, alert.body);
    });

    socket.on('deliveryAssignment', (payload: DispatchAssignmentPayload) => {
      refresh();
      syncNotifications();
      const alert = dispatchAssignmentAlert(payload);
      Alert.alert(alert.title, alert.body);
    });

    socket.on('riderNotification', (payload: RiderNotificationPayload) => {
      syncNotifications();
      refresh();
      const alert = dispatchNotificationAlert(payload);
      Alert.alert(alert.title, alert.body);
    });

    socket.on('orderStatusUpdate', (payload: OrderRealtimePayload) => {
      handlersRef.current.onOrderUpdate?.(payload);
      refresh();
    });

    socket.on('orderEvent', (payload: OrderRealtimePayload) => {
      handlersRef.current.onOrderUpdate?.(payload);
      refresh();
    });

    return () => {
      joinedOrdersRef.current.clear();
      socket.disconnect();
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
}

export function useRiderOrderSocket(orderId: string | undefined, onUpdate: () => void) {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!orderId || !accessToken) return;

    const socket = io(`${getApiOrigin()}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    socket.on('connect', () => {
      socket.emit('joinOrder', { orderId });
    });

    const handle = (data: OrderRealtimePayload) => {
      if (data.orderId !== orderId) return;
      onUpdateRef.current();
    };

    socket.on('orderStatusUpdate', handle);
    socket.on('orderEvent', handle);

    return () => {
      socket.disconnect();
    };
  }, [orderId, accessToken]);
}
