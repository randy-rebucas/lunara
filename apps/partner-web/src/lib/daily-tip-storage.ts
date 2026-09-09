'use client';

const DISMISSED_KEY_PREFIX = 'lunara-partner-daily-tip-dismissed:';

function todayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function isDailyTipDismissedToday(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISSED_KEY_PREFIX + todayKey()) === '1';
  } catch {
    return false;
  }
}

export function dismissDailyTipToday(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISSED_KEY_PREFIX + todayKey(), '1');
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}
