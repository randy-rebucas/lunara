export type CustomerAppSettings = {
  /** Highlight order status updates more prominently on the orders page */
  emphasizeOrderUpdates: boolean;
  /** Show estimated partner distance hints when booking */
  showBranchDistanceHints: boolean;
};

const STORAGE_KEY = 'lunara_customer_settings';

const DEFAULTS: CustomerAppSettings = {
  emphasizeOrderUpdates: true,
  showBranchDistanceHints: true,
};

export function loadCustomerSettings(): CustomerAppSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<CustomerAppSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveCustomerSettings(patch: Partial<CustomerAppSettings>): CustomerAppSettings {
  const next = { ...loadCustomerSettings(), ...patch };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('lunara-customer-settings'));
  }
  return next;
}
