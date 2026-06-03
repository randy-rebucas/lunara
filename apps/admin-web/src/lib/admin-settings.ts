export type AdminAppSettings = {
  /** Tighter table row padding on list pages */
  denseTables: boolean;
  /** Play a sound when a new SOS alert arrives (browser permitting) */
  sosSoundAlerts: boolean;
};

const STORAGE_KEY = 'lunara_admin_settings';

const DEFAULTS: AdminAppSettings = {
  denseTables: false,
  sosSoundAlerts: true,
};

export function loadAdminSettings(): AdminAppSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AdminAppSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAdminSettings(patch: Partial<AdminAppSettings>): AdminAppSettings {
  const next = { ...loadAdminSettings(), ...patch };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('lunara-admin-settings'));
  }
  return next;
}
