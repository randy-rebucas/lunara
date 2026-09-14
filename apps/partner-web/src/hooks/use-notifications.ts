'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PortalNotification } from '../lib/notification-types';
import { getPartnerToken, partnerFetch } from '../lib/partner-api';

export function useNotifications(limit = 30) {
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  // Fetched separately from the (capped) list below — deriving it from items.filter(!read)
  // silently undercounts once a partner has more unread notifications than `limit`.
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const { count } = await partnerFetch<{ count: number }>('/partner/notifications/unread-count');
      setUnreadCount(count);
    } catch {
      // Best-effort — leaves the last known count rather than surfacing a second error state.
    }
  }, []);

  const load = useCallback(async () => {
    if (!getPartnerToken()) {
      setItems([]);
      setLoading(false);
      return;
    }
    setError('');
    try {
      const data = await partnerFetch<PortalNotification[]>(
        `/partner/notifications?limit=${limit}`,
      );
      setItems(data);
      await loadUnreadCount();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications');
      // Keep any previously loaded items on screen — only the initial load has none yet.
    } finally {
      setLoading(false);
    }
  }, [limit, loadUnreadCount]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const markRead = useCallback(
    async (notificationId: string) => {
      let wasUnread = false;
      setItems((prev) =>
        prev.map((item) => {
          if (item._id !== notificationId) return item;
          wasUnread = !item.read;
          return { ...item, read: true };
        }),
      );
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await partnerFetch(`/partner/notifications/${notificationId}/read`, {
          method: 'PATCH',
        });
      } catch {
        await load();
      }
    },
    [load],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    try {
      await partnerFetch('/partner/notifications/read-all', { method: 'PATCH' });
    } catch {
      await load();
    }
  }, [load]);

  return {
    items,
    loading,
    refreshing,
    error,
    unreadCount,
    load,
    refresh,
    markRead,
    markAllRead,
  };
}
