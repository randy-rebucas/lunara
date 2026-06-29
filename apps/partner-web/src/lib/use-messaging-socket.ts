'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveApiOrigin } from '@lunara/utils';
import type { ChatMessage } from '@lunara/types';
import { getPartnerToken } from './partner-api';

interface UseMessagingSocketOptions {
  conversationId: string | null;
  onNewMessage?: (msg: ChatMessage) => void;
}

export function useMessagingSocket({ conversationId, onNewMessage }: UseMessagingSocketOptions) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef({ onNewMessage });

  useEffect(() => {
    handlersRef.current = { onNewMessage };
  });

  useEffect(() => {
    if (!conversationId) return;
    const token = getPartnerToken();
    if (!token) return;

    const apiUrl = resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL);
    const socket: Socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token },
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
  }, [conversationId]);

  return { connected };
}
