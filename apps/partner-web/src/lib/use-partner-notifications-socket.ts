'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveApiOrigin } from '@lunara/utils';
import { getPartnerToken } from './partner-api';

export function usePartnerNotificationsSocket(handlers: { onNotification?: () => void; enabled?: boolean }) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (handlers.enabled === false) return;

    const token = getPartnerToken();
    if (!token) return;

    const apiUrl = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('joinPartnerPortal');
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));

    const refresh = () => handlersRef.current.onNotification?.();
    socket.on('partnerNotification', refresh);

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [handlers.enabled]);

  return { connected };
}
