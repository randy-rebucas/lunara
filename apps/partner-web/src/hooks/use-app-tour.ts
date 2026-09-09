'use client';

import { useCallback, useEffect } from 'react';
import { hasSeenTour, markTourSeen, runTour, type TourStep } from '../lib/app-tour';

/**
 * Wires up a page tour: auto-plays once per browser (per tourId) after content has had a
 * chance to mount, and returns `start` so a page/header can offer a "Take a tour" replay button.
 */
function availableSteps(steps: TourStep[]): TourStep[] {
  return steps.filter((step) => !step.element || document.querySelector(step.element as string));
}

export function useAppTour(tourId: string, steps: TourStep[]) {
  const start = useCallback(() => {
    runTour(availableSteps(steps), () => markTourSeen(tourId));
  }, [steps, tourId]);

  useEffect(() => {
    if (!steps.length || hasSeenTour(tourId)) return;
    // Let the page's own data-driven content render before targeting elements by selector.
    const timer = window.setTimeout(() => {
      const ready = availableSteps(steps);
      if (ready.length) runTour(ready, () => markTourSeen(tourId));
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId]);

  return { start };
}
