import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveApiOrigin } from '@lunara/utils';
import { UserRole } from '@lunara/types';
import { getPartnerToken, getPortalUser } from './partner-api';

export function usePartnerPipelineSocket(
  branchIds: string[],
  handlers: { onPipelineUpdated?: () => void },
) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  const branchKey = branchIds.filter(Boolean).sort().join(',');

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const token = getPartnerToken();
    if (!token) return;

    const ids = branchKey ? branchKey.split(',') : [];
    const apiUrl = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      const user = getPortalUser();
      if (user?.role === UserRole.PARTNER) {
        socket.emit('joinPartnerOperations');
      }
      for (const branchId of ids) {
        if (branchId) socket.emit('joinBranch', { branchId });
      }
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));

    const refresh = () => handlersRef.current.onPipelineUpdated?.();
    socket.on('partnerPipelineUpdated', refresh);
    socket.on('branchPipelineUpdated', refresh);

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [branchKey]);

  return { connected };
}

export function usePartnerOrderSocket(
  orderId: string | undefined,
  handlers: { onOrderUpdated?: () => void },
) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!orderId) return;
    const token = getPartnerToken();
    if (!token) return;

    const apiUrl = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('joinOrder', { orderId });
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));

    const refresh = () => handlersRef.current.onOrderUpdated?.();
    socket.on('orderStatusUpdate', refresh);
    socket.on('orderEvent', refresh);

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [orderId]);

  return { connected };
}
