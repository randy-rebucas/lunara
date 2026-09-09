'use client';

import { driver, type Config, type DriveStep } from 'driver.js';

const SEEN_KEY_PREFIX = 'lunara-partner-tour-seen:';

export type TourStep = DriveStep;

export function hasSeenTour(tourId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SEEN_KEY_PREFIX + tourId) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen(tourId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_KEY_PREFIX + tourId, '1');
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

const driverConfig: Partial<Config> = {
  showProgress: true,
  animate: true,
  overlayOpacity: 0.55,
  stagePadding: 6,
  popoverClass: 'lunara-tour-popover',
  nextBtnText: 'Next →',
  prevBtnText: '← Back',
  doneBtnText: 'Done',
};

export function runTour(steps: TourStep[], onDone?: () => void): void {
  if (!steps.length) return;
  const d = driver({
    ...driverConfig,
    steps,
    onDestroyed: () => onDone?.(),
  });
  d.drive();
}
