'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { adminFetch } from '../lib/admin-api';
import { subscribeAdminRealtime } from '../lib/admin-realtime';

interface ConversationSummary {
  _id: string;
  unreadCount: number;
}

export function useAdminMessageBadge() {
  const [unreadTotal, setUnreadTotal] = useState(0);
  const pathname = usePathname();
  const isOnMessages = pathname?.startsWith('/messages') ?? false;

  // Clear badge while the messages page is open
  useEffect(() => {
    if (isOnMessages) setUnreadTotal(0);
  }, [isOnMessages]);

  useEffect(() => {
    adminFetch<ConversationSummary[]>('/admin/messages')
      .then((convos) => {
        const total = convos.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
        setUnreadTotal(total);
      })
      .catch(() => {});

    return subscribeAdminRealtime({
      onNewMessage: () => {
        // Only increment if admin is not currently on the messages page
        setUnreadTotal((prev) => (isOnMessagesRef.current ? 0 : prev + 1));
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref so the socket callback always reads the current value
  const isOnMessagesRef = useRef(isOnMessages);
  isOnMessagesRef.current = isOnMessages;

  return { unreadTotal: isOnMessages ? 0 : unreadTotal };
}
