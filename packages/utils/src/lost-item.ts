export const LOST_ITEM_FLOW = [
  { id: 'complaint', label: 'Customer complaint' },
  { id: 'investigation', label: 'Investigation' },
  { id: 'photos_reviewed', label: 'Review photos' },
  { id: 'logs_reviewed', label: 'Review laundry logs' },
  { id: 'outcome', label: 'Determine outcome' },
  { id: 'compensation', label: 'Compensation' },
  { id: 'closed', label: 'Close ticket' },
] as const;

export type LostItemFlowStageId = (typeof LOST_ITEM_FLOW)[number]['id'];

export function lostItemFlowIndex(stage: string): number {
  return LOST_ITEM_FLOW.findIndex((s) => s.id === stage);
}

export function formatLostItemOutcome(outcome?: string): string {
  if (!outcome || outcome === 'pending') return 'Pending';
  const labels: Record<string, string> = {
    found: 'Item found',
    compensated: 'Compensated',
    no_action: 'No action required',
    denied: 'Claim denied',
  };
  return labels[outcome] ?? outcome;
}
