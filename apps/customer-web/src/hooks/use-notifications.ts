import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import type { AppNotification } from '../lib/notification-types';

export function useNotifications(limit = 20) {
  const { api, isAuthenticated } = useAuthContext();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }
    setError('');
    try {
      const res = await api.get<AppNotification[]>(`/notifications/me?limit=${limit}`);
      setItems(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, [api, isAuthenticated, limit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onBump = () => {
      void load();
    };
    window.addEventListener('lunara-notifications-bump', onBump);
    return () => window.removeEventListener('lunara-notifications-bump', onBump);
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
        await api.patch(`/notifications/${notificationId}/read`, {});
        window.dispatchEvent(new CustomEvent('lunara-notifications-bump'));
      } catch {
        await load();
      }
    },
    [api, load],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await api.patch('/notifications/read-all', {});
      window.dispatchEvent(new CustomEvent('lunara-notifications-bump'));
    } catch {
      await load();
    }
  }, [api, load]);

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
