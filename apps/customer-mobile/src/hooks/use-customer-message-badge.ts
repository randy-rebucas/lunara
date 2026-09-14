import { useEffect, useState } from 'react';
import type { CustomerConversation } from '@lunara/types';
import { useAuthStore } from '../store/auth';

const POLL_MS = 30_000;

/** Lightweight unread-count poll for the header badge — mirrors rider-mobile's
 * useRiderMessageBadge so the badge stays live even when the messages screen isn't mounted. */
export function useCustomerMessageBadge() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on sign-out, not a synchronous render loop
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const poll = async () => {
      const convo = await apiFetch<CustomerConversation>('/customers/messages').catch(() => null);
      if (!cancelled) {
        setUnreadCount(convo?.unreadCount ?? 0);
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, apiFetch]);

  return unreadCount;
}
