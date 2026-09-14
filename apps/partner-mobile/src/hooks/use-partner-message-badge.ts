import { useEffect, useState } from 'react';
import type { PartnerConversation } from '@lunara/types';
import { useAuthStore } from '../store/auth';
import { partnerFetch } from '../api';

const POLL_MS = 30_000;

/** Lightweight unread-count poll for the header badge — mirrors useNotificationBadge so the
 * badge stays live even on tabs that never mount the messages screen. */
export function usePartnerMessageBadge() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on sign-out, not a synchronous render loop
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const convo = await partnerFetch<PartnerConversation>('/partner/messages');
        if (!cancelled) setUnreadCount(convo.unreadCount ?? 0);
      } catch {
        // Badge is best-effort — a failed poll just leaves the last known count.
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken]);

  return unreadCount;
}
