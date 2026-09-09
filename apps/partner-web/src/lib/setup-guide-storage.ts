'use client';

const DISMISSED_KEY = 'lunara-partner-setup-guide-dismissed';
const OPEN_KEY = 'lunara-partner-setup-guide-open';

export function isSetupGuideDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissSetupGuide(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

export function isSetupGuideOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSetupGuideOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}
