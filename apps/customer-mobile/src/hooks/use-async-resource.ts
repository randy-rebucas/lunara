import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { toErrorMessage } from '../lib/api-error';

interface UseAsyncResourceOptions {
  /** Skip the initial automatic load-on-mount (e.g. while a required param is still unknown). */
  enabled?: boolean;
  /** Message shown when the fetcher throws something other than an `Error`. */
  errorFallback?: string;
}

interface UseAsyncResourceResult<T> {
  data: T | null;
  loading: boolean;
  error: string;
  refreshing: boolean;
  /** Re-runs the fetcher without touching `refreshing` — use for the initial/retry load. */
  reload: () => Promise<void>;
  /** Re-runs the fetcher via pull-to-refresh, toggling `refreshing` instead of `loading`. */
  onRefresh: () => Promise<void>;
  setData: Dispatch<SetStateAction<T | null>>;
}

/** Shared `{data, loading, error, refreshing, reload, onRefresh}` scaffold repeated near-verbatim
 * across `orders.tsx`, `orders/[id]/index.tsx`, `review/[id].tsx`, `subscriptions/index.tsx`, etc.
 * `fetcher` is re-run whenever its identity changes (wrap it in `useCallback` at the call site,
 * same as the original hand-rolled `load` functions this replaces). */
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  options: UseAsyncResourceOptions = {},
): UseAsyncResourceResult<T> {
  const { enabled = true, errorFallback = 'Failed to load' } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setError('');
    try {
      const result = await fetcher();
      setData(result);
    } catch (e) {
      setError(toErrorMessage(e, errorFallback));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetcher, enabled, errorFallback]);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    reload();
    // `reload` already depends on `fetcher`, so this effect re-runs exactly when the caller's
    // fetcher identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, enabled]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  return { data, loading, error, refreshing, reload, onRefresh, setData };
}
