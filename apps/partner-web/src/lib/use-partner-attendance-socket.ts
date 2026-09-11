'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveApiOrigin } from '@lunara/utils';
import { getPartnerToken } from './partner-api';

/** Live push for the partner portal's Attendance tab — joins the same `partner:{id}` room as
 * other partner realtime features (see joinPartnerPortal in tracking.gateway.ts) and refetches
 * on any clock-in/out/correction instead of polling. */
export function usePartnerAttendanceSocket(handlers: { onUpdate?: () => void; enabled?: boolean }) {
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

    const refresh = () => handlersRef.current.onUpdate?.();
    socket.on('attendanceUpdate', refresh);

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [handlers.enabled]);

  return { connected };
}
