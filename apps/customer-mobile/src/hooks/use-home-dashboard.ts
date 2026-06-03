import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrderRealtimeStore } from '../store/order-realtime';
import { useAuthStore } from '../store/auth';
import type { CustomerProfile } from '../lib/profile-types';
import { isActiveOrderStatus } from '../lib/active-order';

export interface HomeOrderRow {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  scheduledDeliveryAt?: string;
}

export function useHomeDashboard() {
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const user = useAuthStore((s) => s.user);
  const realtimeTick = useOrderRealtimeStore((s) => s.tick);

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<HomeOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [profileData, ordersData] = await Promise.all([
        apiFetch<CustomerProfile>('/customers/me'),
        apiFetch<{ items: HomeOrderRow[] }>('/orders'),
      ]);
      setProfile(profileData);
      setOrders(ordersData.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (realtimeTick === 0) return;
    load().catch(() => {});
  }, [realtimeTick, load]);

  const activeOrders = useMemo(
    () => orders.filter((o) => isActiveOrderStatus(o.status)),
    [orders],
  );

  return {
    user,
    profile,
    orders,
    activeOrders,
    loading,
    error,
    refresh: load,
  };
}
