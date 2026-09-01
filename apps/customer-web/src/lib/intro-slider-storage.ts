const KEY = 'lunara_intro_seen';

/** Fails open (treated as seen) so a storage error never traps the user behind the slider. */
export function hasSeenIntro(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

export function markIntroSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // best-effort — a failed write just means the intro may show again next load
  }
}
