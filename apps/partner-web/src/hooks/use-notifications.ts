'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortalNotification } from '../lib/notification-types';
import { getPartnerToken, partnerFetch } from '../lib/partner-api';

export function useNotifications(limit = 30) {
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

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
      setItems((prev) =>
        prev.map((item) => (item._id === notificationId ? { ...item, read: true } : item)),
      );
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
    try {
      await partnerFetch('/partner/notifications/read-all', { method: 'PATCH' });
    } catch {
      await load();
    }
  }, [load]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

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
