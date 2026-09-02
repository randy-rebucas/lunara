'use client';

import { useEffect, useRef } from 'react';

export function useDebouncedEffect(effect: () => void, deps: unknown[], delayMs: number) {
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timeout = setTimeout(effect, delayMs);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
