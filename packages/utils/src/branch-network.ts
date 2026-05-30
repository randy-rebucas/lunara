export type BranchNetworkType = 'hq' | 'franchise' | 'partner_shop';

export const BRANCH_TYPE_LABELS: Record<BranchNetworkType, string> = {
  hq: 'Lunara HQ',
  franchise: 'Franchise branch',
  partner_shop: 'Partner laundry shop',
};

export interface BranchPerformanceMetrics {
  completedOrders30d: number;
  onTimeRatePercent: number;
  performanceScore: number;
  performanceLabel: string;
  ordersToday: number;
  revenueToday: number;
  utilizationWeightPercent: number;
}
