const PREFS_KEY = 'lunara_ai_agents_prefs';

export interface AiAgentsPrefs {
  sendOnEnter: boolean;
}

const DEFAULT_PREFS: AiAgentsPrefs = {
  sendOnEnter: true,
};

export function getPrefs(): AiAgentsPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setPrefs(patch: Partial<AiAgentsPrefs>) {
  if (typeof window === 'undefined') return;
  const next = { ...getPrefs(), ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}
