import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { UserRole } from '@lunara/types';
import { getApiOrigin } from '../api-config';
import { useAuthStore } from '../store/auth';

interface PartnerRealtimeHandlers {
  /** Fired when the partner/branch order pipeline changes (accept, receive, process, deliver). */
  onPipelineUpdated?: () => void;
  /** Fired for partner-portal in-app notifications (rider reassignment, refunds, etc). */
  onPartnerNotification?: (payload: Record<string, unknown>) => void;
}

/**
 * Subscribes to live pipeline/notification updates for the signed-in partner or staff member.
 * Mirrors apps/partner-web's usePartnerPipelineSocket so both partner surfaces share the same
 * server-side rooms (partner:<id> / branch:<id>). This is a projection only — screens must still
 * be able to load their own state via a normal fetch/poll if the socket never connects.
 */
export function usePartnerRealtimeSocket(handlers: PartnerRealtimeHandlers) {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const role = useAuthStore((s) => s.user?.role);
  const branchId = useAuthStore((s) => s.user?.branchId);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!accessToken || !role) return;

    const apiUrl = getApiOrigin();
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    socket.on('connect', () => {
      if (role === UserRole.PARTNER) {
        socket.emit('joinPartnerOperations');
      } else {
        socket.emit('joinPartnerPortal');
        if (branchId) socket.emit('joinBranch', { branchId });
      }
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));

    const onPipelineUpdated = () => handlersRef.current.onPipelineUpdated?.();
    socket.on('partnerPipelineUpdated', onPipelineUpdated);
    socket.on('branchPipelineUpdated', onPipelineUpdated);
    socket.on('partnerNotification', (payload: Record<string, unknown>) => {
      handlersRef.current.onPartnerNotification?.(payload);
    });

    return () => {
      setConnected(false);
      socket.disconnect();
    };
  }, [accessToken, role, branchId]);

  return { connected };
}
