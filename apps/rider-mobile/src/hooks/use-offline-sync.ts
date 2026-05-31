import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { getPendingCount, subscribeQueue } from '../lib/offline/queue-store';
import { useNetworkStatus } from '../lib/offline/network';
import { isSyncing, runSync, subscribeSyncing } from '../lib/offline/sync-engine';

export function useOfflineSync() {
  const isOnline = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(isSyncing());

  const refreshPending = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline) return { synced: 0, remaining: pendingCount };
    const result = await runSync();
    await refreshPending();
    return result;
  }, [isOnline, pendingCount, refreshPending]);

  useEffect(() => {
    refreshPending();
    return subscribeQueue(() => {
      void refreshPending();
    });
  }, [refreshPending]);

  useEffect(() => {
    return subscribeSyncing(setSyncing);
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    void refreshPending().then(() => syncNow());
  }, [isOnline]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active' && isOnline) {
        void refreshPending();
        void syncNow();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [isOnline, refreshPending, syncNow]);

  return {
    isOnline,
    pendingCount,
    syncing,
    syncNow,
    refreshPending,
  };
}

export function useOrderPendingCount(orderId: string | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    const refresh = async () => {
      const items = await import('../lib/offline/queue-store').then((m) => m.getQueueItems());
      setCount(items.filter((i) => (i.kind === 'gps' ? i.orderId === orderId : i.orderId === orderId)).length);
    };
    refresh();
    return subscribeQueue(() => {
      void refresh();
    });
  }, [orderId]);

  return count;
}
