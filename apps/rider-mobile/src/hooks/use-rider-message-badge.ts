import { useEffect, useState } from 'react';
import type { RiderConversation } from '@lunara/types';
import { useAuthStore } from '../store/auth';
import { riderMessagingFetch } from '../api';

const POLL_MS = 30_000;

/** Lightweight unread-count poll for the header badge — mirrors partner-mobile's
 * usePartnerMessageBadge so the badge stays live even when the messages screen isn't mounted. */
export function useRiderMessageBadge() {
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
      // Employer channel 404s for riders with no connected partner yet — that's expected, not
      // an error, so it's swallowed independently of the admin-channel poll below.
      const [adminConvo, employerConvo] = await Promise.all([
        riderMessagingFetch<RiderConversation>('/riders/messages').catch(() => null),
        riderMessagingFetch<RiderConversation>('/riders/employer-messages').catch(() => null),
      ]);
      if (!cancelled) {
        setUnreadCount((adminConvo?.unreadCount ?? 0) + (employerConvo?.unreadCount ?? 0));
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
