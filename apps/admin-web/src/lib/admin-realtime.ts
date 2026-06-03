import { io, type Socket } from 'socket.io-client';
import { resolveApiOrigin } from '@lunara/utils';
import { getAdminToken } from './admin-api';
import type { DispatcherAlert, SosLocationUpdate } from './use-admin-operations-socket';

type VoidListener = () => void;
type AlertListener = (alert: DispatcherAlert) => void;
type LocationListener = (update: SosLocationUpdate) => void;
type ConnectedListener = (connected: boolean) => void;

let socket: Socket | null = null;
let subscriberCount = 0;
let connected = false;

const dispatchQueueListeners = new Set<VoidListener>();
const dispatcherAlertListeners = new Set<AlertListener>();
const sosLocationListeners = new Set<LocationListener>();
const connectedListeners = new Set<ConnectedListener>();

function setConnected(next: boolean) {
  if (connected === next) return;
  connected = next;
  for (const listener of connectedListeners) listener(next);
}

function emitDispatchQueueUpdated() {
  for (const listener of dispatchQueueListeners) listener();
}

function emitDispatcherAlert(alert: DispatcherAlert) {
  for (const listener of dispatcherAlertListeners) listener(alert);
}

function emitSosLocationUpdate(update: SosLocationUpdate) {
  for (const listener of sosLocationListeners) listener(update);
}

function ensureSocket() {
  const token = getAdminToken();
  if (!token) return;

  if (socket) return;

  const apiUrl = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
  socket = io(`${apiUrl}/tracking`, {
    transports: ['websocket'],
    auth: { token },
  });

  socket.on('connect', () => {
    socket?.emit('joinAdminOperations');
    setConnected(true);
  });
  socket.on('disconnect', () => setConnected(false));

  socket.on('dispatchQueueUpdated', emitDispatchQueueUpdated);
  socket.on('dispatcherAlert', emitDispatcherAlert);
  socket.on('sosLocationUpdate', emitSosLocationUpdate);
}

function teardownSocket() {
  socket?.disconnect();
  socket = null;
  setConnected(false);
}

/** Subscribe to the shared admin operations socket. Returns an unsubscribe function. */
export function subscribeAdminRealtime(handlers: {
  onDispatchQueueUpdated?: VoidListener;
  onDispatcherAlert?: AlertListener;
  onSosLocationUpdate?: LocationListener;
  onConnected?: ConnectedListener;
}): () => void {
  subscriberCount += 1;
  ensureSocket();
  handlers.onConnected?.(connected);

  if (handlers.onDispatchQueueUpdated) {
    dispatchQueueListeners.add(handlers.onDispatchQueueUpdated);
  }
  if (handlers.onDispatcherAlert) {
    dispatcherAlertListeners.add(handlers.onDispatcherAlert);
  }
  if (handlers.onSosLocationUpdate) {
    sosLocationListeners.add(handlers.onSosLocationUpdate);
  }
  if (handlers.onConnected) {
    connectedListeners.add(handlers.onConnected);
  }

  return () => {
    if (handlers.onDispatchQueueUpdated) {
      dispatchQueueListeners.delete(handlers.onDispatchQueueUpdated);
    }
    if (handlers.onDispatcherAlert) {
      dispatcherAlertListeners.delete(handlers.onDispatcherAlert);
    }
    if (handlers.onSosLocationUpdate) {
      sosLocationListeners.delete(handlers.onSosLocationUpdate);
    }
    if (handlers.onConnected) {
      connectedListeners.delete(handlers.onConnected);
    }

    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0) {
      teardownSocket();
    }
  };
}

export function isAdminRealtimeConnected() {
  return connected;
}
