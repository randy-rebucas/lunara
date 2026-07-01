export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  /** Min digits for the local number (after dial code) */
  minLen: number;
  maxLen: number;
}

export const COUNTRIES: Country[] = [
  { code: 'PH', name: 'Philippines',   dialCode: '+63',  flag: '🇵🇭', minLen: 10, maxLen: 10 },
  { code: 'SG', name: 'Singapore',     dialCode: '+65',  flag: '🇸🇬', minLen: 8,  maxLen: 8  },
  { code: 'MY', name: 'Malaysia',      dialCode: '+60',  flag: '🇲🇾', minLen: 9,  maxLen: 11 },
  { code: 'ID', name: 'Indonesia',     dialCode: '+62',  flag: '🇮🇩', minLen: 9,  maxLen: 12 },
  { code: 'TH', name: 'Thailand',      dialCode: '+66',  flag: '🇹🇭', minLen: 9,  maxLen: 9  },
  { code: 'VN', name: 'Vietnam',       dialCode: '+84',  flag: '🇻🇳', minLen: 9,  maxLen: 10 },
  { code: 'US', name: 'United States', dialCode: '+1',   flag: '🇺🇸', minLen: 10, maxLen: 10 },
  { code: 'CA', name: 'Canada',        dialCode: '+1',   flag: '🇨🇦', minLen: 10, maxLen: 10 },
  { code: 'AU', name: 'Australia',     dialCode: '+61',  flag: '🇦🇺', minLen: 9,  maxLen: 9  },
  { code: 'GB', name: 'United Kingdom',dialCode: '+44',  flag: '🇬🇧', minLen: 10, maxLen: 10 },
  { code: 'AE', name: 'UAE',           dialCode: '+971', flag: '🇦🇪', minLen: 9,  maxLen: 9  },
  { code: 'SA', name: 'Saudi Arabia',  dialCode: '+966', flag: '🇸🇦', minLen: 9,  maxLen: 9  },
  { code: 'QA', name: 'Qatar',         dialCode: '+974', flag: '🇶🇦', minLen: 8,  maxLen: 8  },
  { code: 'KW', name: 'Kuwait',        dialCode: '+965', flag: '🇰🇼', minLen: 8,  maxLen: 8  },
  { code: 'JP', name: 'Japan',         dialCode: '+81',  flag: '🇯🇵', minLen: 10, maxLen: 11 },
  { code: 'KR', name: 'South Korea',   dialCode: '+82',  flag: '🇰🇷', minLen: 9,  maxLen: 10 },
  { code: 'IN', name: 'India',         dialCode: '+91',  flag: '🇮🇳', minLen: 10, maxLen: 10 },
  { code: 'HK', name: 'Hong Kong',     dialCode: '+852', flag: '🇭🇰', minLen: 8,  maxLen: 8  },
];

export function detectCountry(): Country {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split('-').pop()?.toUpperCase() ?? 'PH';
    return COUNTRIES.find((c) => c.code === region) ?? COUNTRIES[0];
  } catch {
    return COUNTRIES[0];
  }
}

/** Returns an E.164-ish number: dialCode + localDigits (no leading zero) */
export function buildE164(dialCode: string, localNumber: string): string {
  const digits = localNumber.replace(/\D/g, '').replace(/^0+/, '');
  return `${dialCode}${digits}`;
}

export function isValidLocalNumber(country: Country, localNumber: string): boolean {
  const digits = localNumber.replace(/\D/g, '').replace(/^0+/, '');
  return digits.length >= country.minLen && digits.length <= country.maxLen;
}
