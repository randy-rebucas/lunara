export function formatCurrency(
  amount: number,
  currency = 'PHP',
  locale = 'en-PH',
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

/** Normalize a Philippine mobile number to E.164 (+639XXXXXXXXX). */
export function formatPhone(phone: string): string {
  const trimmed = phone.trim().replace(/[\s()-]/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.startsWith('63')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+63${digits}`;
  }
  return `+${digits}`;
}

export function isValidPhilippineMobile(phone: string): boolean {
  return /^\+639\d{9}$/.test(formatPhone(phone));
}
