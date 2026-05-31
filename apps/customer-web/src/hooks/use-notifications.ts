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
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api, isAuthenticated, limit]);

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
        await api.patch(`/notifications/${notificationId}/read`, {});
      } catch {
        await load();
      }
    },
    [api, load],
  );

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
  };
}
