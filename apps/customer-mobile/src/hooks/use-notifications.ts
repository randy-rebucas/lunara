import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppNotification } from '../lib/notification-types';
import { useNotificationSyncStore } from '../store/notification-sync';
import { useAuthStore } from '../store/auth';

export function useNotifications(limit = 20) {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const syncTick = useNotificationSyncStore((s) => s.tick);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await apiFetch<AppNotification[]>(`/notifications/me?limit=${limit}`);
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
  }, [load, syncTick]);

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
        await apiFetch(`/notifications/${notificationId}/read`, { method: 'PATCH' });
      } catch {
        await load();
      }
    },
    [apiFetch, load],
  );

  const markAllRead = useCallback(async () => {
    const previous = items;
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
    } catch {
      setItems(previous);
    }
  }, [apiFetch, items]);

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
