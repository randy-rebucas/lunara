import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StaffNotification } from '../lib/notification-types';
import { partnerFetch } from '../api';

export function useNotifications(limit = 30) {
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await partnerFetch<StaffNotification[]>(`/partner/notifications?limit=${limit}`);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch/update-on-mount, not a synchronous render loop
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const markRead = useCallback(async (notificationId: string) => {
    setItems((prev) => prev.map((item) => (item._id === notificationId ? { ...item, read: true } : item)));
    try {
      await partnerFetch(`/partner/notifications/${notificationId}/read`, { method: 'PATCH' });
    } catch {
      await load();
    }
  }, [load]);

  const markAllRead = useCallback(async () => {
    const hadUnread = items.some((item) => !item.read);
    if (!hadUnread) return;
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await partnerFetch('/partner/notifications/read-all', { method: 'PATCH' });
    } catch {
      await load();
    }
  }, [items, load]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  return { items, loading, refreshing, error, unreadCount, load, refresh, markRead, markAllRead };
}
