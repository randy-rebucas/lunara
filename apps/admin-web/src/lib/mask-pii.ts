/** Mask sensitive account numbers for display in admin tables. */
export function maskAccountNumber(value: string, visibleTail = 4): string {
  const trimmed = value.trim();
  if (trimmed.length <= visibleTail) return trimmed;
  return `${'•'.repeat(Math.min(trimmed.length - visibleTail, 8))}${trimmed.slice(-visibleTail)}`;
}

export function maskPayoutDetails(row: {
  gcashNumber?: string;
  mayaNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
}): string {
  if (row.gcashNumber) return `GCash ${maskAccountNumber(row.gcashNumber)}`;
  if (row.mayaNumber) return `Maya ${maskAccountNumber(row.mayaNumber)}`;
  if (row.bankAccountNumber) {
    return `${row.bankName ?? 'Bank'} · ${row.bankAccountName ?? '—'} · ${maskAccountNumber(row.bankAccountNumber)}`;
  }
  return '—';
}
