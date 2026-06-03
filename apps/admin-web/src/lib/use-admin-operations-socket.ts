import { useEffect, useRef, useState } from 'react';
import { isAdminRealtimeConnected, subscribeAdminRealtime } from './admin-realtime';

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
  const [connected, setConnected] = useState(isAdminRealtimeConnected);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    return subscribeAdminRealtime({
      onConnected: setConnected,
      onDispatchQueueUpdated: () => handlersRef.current.onDispatchQueueUpdated?.(),
      onDispatcherAlert: (alert) => handlersRef.current.onDispatcherAlert?.(alert),
      onSosLocationUpdate: (update) => handlersRef.current.onSosLocationUpdate?.(update),
    });
  }, []);

  return { connected };
}
