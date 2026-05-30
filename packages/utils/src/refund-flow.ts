export const REFUND_FLOW = [
  { id: 'submitted', label: 'Submit refund request' },
  { id: 'admin_review', label: 'Admin review' },
  { id: 'order_verified', label: 'Verify order' },
  { id: 'decision', label: 'Approve / reject' },
  { id: 'processed', label: 'Process refund' },
  { id: 'notified', label: 'Notify customer' },
] as const;

export type RefundFlowStageId = (typeof REFUND_FLOW)[number]['id'];

export function refundFlowIndex(stage: string): number {
  return REFUND_FLOW.findIndex((s) => s.id === stage);
}

export function formatRefundStatus(status: string): string {
  return status.replace(/_/g, ' ');
}
