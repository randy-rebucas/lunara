import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveApiOrigin } from '@lunara/utils';
import { getAdminToken } from './admin-api';

export interface DispatcherAlert {
  type?: string;
  orderId?: string;
  incidentId?: string;
  riderUserId?: string;
  riderName?: string;
  message?: string;
  branchName?: string;
  status?: string;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  at?: string;
}

export interface SosLocationUpdate {
  incidentId: string;
  orderId: string;
  riderUserId: string;
  riderName: string;
  lat: number;
  lng: number;
  timestamp: string;
  mapsUrl?: string;
}

export function useAdminOperationsSocket(handlers: {
  onDispatchQueueUpdated?: () => void;
  onDispatcherAlert?: (alert: DispatcherAlert) => void;
  onSosLocationUpdate?: (update: SosLocationUpdate) => void;
}) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;

    const apiUrl = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('joinAdminOperations');
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('dispatchQueueUpdated', () => {
      handlersRef.current.onDispatchQueueUpdated?.();
    });
    socket.on('dispatcherAlert', (data: DispatcherAlert) => {
      handlersRef.current.onDispatcherAlert?.(data);
    });
    socket.on('sosLocationUpdate', (data: SosLocationUpdate) => {
      handlersRef.current.onSosLocationUpdate?.(data);
    });

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, []);

  return { connected };
}
