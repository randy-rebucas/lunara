export function refundStatusBadgeClass(status: string) {
  switch (status) {
    case 'pending':
      return 'badge-accent';
    case 'under_review':
    case 'verified':
      return 'badge-primary';
    case 'approved':
    case 'processed':
      return 'badge-primary';
    case 'rejected':
      return 'badge-secondary';
    case 'closed':
      return 'badge-secondary';
    default:
      return 'badge-secondary';
  }
}

export function formatRefundDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Refund still in progress — customer should not open another for the same order. */
export function isOpenRefundStatus(status: string) {
  return !['rejected', 'closed', 'processed'].includes(status);
}
