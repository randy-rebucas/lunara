export function formatTicketType(type: string) {
  switch (type) {
    case 'lost_item':
      return 'Lost item';
    case 'area_coverage':
      return 'Pickup area';
    case 'general':
      return 'General';
    default:
      return type.replace(/_/g, ' ');
  }
}

export function formatTicketStatus(status: string) {
  return status.replace(/_/g, ' ');
}

export function ticketStatusBadgeClass(status: string) {
  switch (status) {
    case 'open':
      return 'badge-accent';
    case 'in_progress':
      return 'badge-primary';
    case 'resolved':
    case 'closed':
      return 'badge-secondary';
    default:
      return 'badge-secondary';
  }
}

export function formatTicketDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
