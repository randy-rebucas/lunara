import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ChatMessage } from '@lunara/types';
import { getApiOrigin } from '../api-config';
import { useAuthStore } from '../store/auth';

interface UsePartnerMessagingSocketOptions {
  conversationId: string | null;
  onNewMessage?: (msg: ChatMessage) => void;
}

/** Mirrors apps/partner-web's useMessagingSocket so both partner surfaces share the same
 * server-side `conversation:<id>` room. Projection only — the screen still loads its own
 * message list on mount, so a missed/late socket connection never leaves it stuck empty. */
export function usePartnerMessagingSocket({ conversationId, onNewMessage }: UsePartnerMessagingSocketOptions) {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef({ onNewMessage });

  useEffect(() => {
    handlersRef.current = { onNewMessage };
  });

  useEffect(() => {
    if (!conversationId || !accessToken) return;

    const apiUrl = getApiOrigin();
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    socket.on('connect', () => {
      socket.emit('joinConversation', { conversationId });
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('newMessage', (msg: ChatMessage) => {
      handlersRef.current.onNewMessage?.(msg);
    });

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [conversationId, accessToken]);

  return { connected };
}
