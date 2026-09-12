import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { partnerFetch } from '../api';
import type { StaffNotification } from '../lib/notification-types';

const POLL_MS = 30_000;

/** Lightweight unread-count poll for the header bell badge — separate from useNotifications so
 * the badge stays live even on tabs that never mount the notifications screen. */
export function useNotificationBadge() {
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
        const data = await partnerFetch<StaffNotification[]>('/partner/notifications?limit=30');
        if (!cancelled) setUnreadCount(data.filter((n) => !n.read).length);
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
