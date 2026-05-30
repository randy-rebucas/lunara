export function formatCurrency(
  amount: number,
  currency = 'PHP',
  locale = 'en-PH',
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+63${digits.slice(1)}`;
  }
  return phone.startsWith('+') ? phone : `+${digits}`;
}
