import { useCallback, useEffect, useRef } from 'react';

/** Returns a debounced wrapper that coalesces rapid calls into one after `delayMs`. */
export function useDebouncedCallback(callback: () => void, delayMs: number): () => void {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      callbackRef.current();
    }, delayMs);
  }, [delayMs]);
}
