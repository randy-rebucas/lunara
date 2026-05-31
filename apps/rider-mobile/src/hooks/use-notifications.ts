import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RiderNotification } from '../lib/notification-types';
import { useAuthStore } from '../store/auth';

export function useNotifications(limit = 20) {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [items, setItems] = useState<RiderNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiFetch<RiderNotification[]>(`/riders/notifications?limit=${limit}`);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, limit]);

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
        await apiFetch(`/riders/notifications/${notificationId}/read`, { method: 'PATCH' });
      } catch {
        await load();
      }
    },
    [apiFetch, load],
  );

  const markAllRead = useCallback(async () => {
    const unread = items.filter((item) => !item.read);
    await Promise.all(unread.map((item) => markRead(item._id)));
  }, [items, markRead]);

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
