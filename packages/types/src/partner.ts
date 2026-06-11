import type { BookingType, OrderStatus, UserRole } from './enums.js';

export type PortalRole = UserRole.PARTNER | UserRole.STAFF | UserRole.ADMIN;

export interface PortalUser {
  email?: string;
  role: PortalRole;
  branchId?: string;
}

export interface PartnerPortalSettings {
  acceptingOrders: boolean;
  autoAcceptIncoming: boolean;
  notifyNewOrders: boolean;
  notifyPickupArriving: boolean;
  notifyLowStock: boolean;
  notifyReadyForDelivery: boolean;
  allowStaffToRequestDelivery: boolean;
  requireWeightVerificationOnReceive: boolean;
}

export interface PartnerShopBranchSummary {
  id: string;
  code: string;
  name: string;
  line1: string;
  city: string;
  province: string;
  isActive: boolean;
  maxActiveOrders: number;
  maxWeightCapacityKg: number;
  dailyQuotaOrders: number;
  dailyQuotaWeightKg: number;
  serviceRadiusKm: number;
}

export interface PartnerSettingsData {
  branch: PartnerShopBranchSummary;
  settings: PartnerPortalSettings;
  canEdit: boolean;
}

export interface PartnerDashboardShop {
  name: string;
  code: string;
}

export interface PartnerDashboardData {
  shop?: PartnerDashboardShop;
  counts: {
    incoming: number;
    awaitingAccept: number;
    inProcessing: number;
    readyForDelivery: number;
    completedToday: number;
    staffMembers: number;
    lowStockItems: number;
  };
  revenue: { today: number; week: number; todayOrders: number; weekOrders: number };
  recentOrders: PartnerOrderSummary[];
}

export interface PartnerOrderSummary {
  _id: string;
  bookingType: BookingType | string;
  status: OrderStatus | string;
  total: number;
  branchName?: string;
  branchId?: string;
  currentStepLabel?: string;
  assignedStaffEmail?: string;
  partnerAcceptedAt?: string;
  canAccept?: boolean;
  canRequestPickup?: boolean;
  canRequestDelivery?: boolean;
  canReceiveAtShop?: boolean;
  receivingStepLabel?: string;
  slaLabel?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentReceiptCode?: string;
  cashTiming?: 'pickup' | 'delivery';
  paymentLabel?: string;
}

export interface PartnerQueueOrder {
  _id: string;
  status: string;
  bookingType: string;
  total: number;
  currentStepLabel: string;
  progress: number;
  assignedStaffId?: string;
  isAssigned?: boolean;
  branchId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentLabel?: string;
}
  _id: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  activeJobs: number;
}

export interface PartnerInventoryItem {
  _id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  isLowStock?: boolean;
}

export interface PartnerReportData {
  periodDays: number;
  from: string;
  totalOrders: number;
  completedOrders: number;
  revenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  completedByService: Record<string, number>;
}

export interface PartnerRevenueDailyPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface PartnerRevenueData {
  today: number;
  week: number;
  month: number;
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  avgOrderToday: number;
  avgOrderMonth: number;
  allTimeCompletedOrders: number;
  allTimeRevenue: number;
  daily: PartnerRevenueDailyPoint[];
}

export interface PartnerReceivingView {
  order: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
    estimatedWeightKg?: number;
    branchName?: string;
    pickup?: { actualWeightKg?: number; receiptCode?: string };
  };
  shopReceiving?: {
    receivedAt?: string;
    verifiedWeightKg?: number;
    weightVerifiedAt?: string;
    itemCount?: number;
    itemsConfirmedAt?: string;
  };
  workflowSteps: string[];
  workflowStep: number;
  workflowStepLabel?: string;
  canReceive: boolean;
  canVerifyWeight: boolean;
  canConfirmItems: boolean;
  isComplete: boolean;
}

export interface PartnerProcessingView {
  /** Pickup / transit phase — not yet in the laundry processing queue. */
  preProcessing?: boolean;
  order: {
    _id: string;
    status: string;
    bookingType: string;
    total: number;
    estimatedWeightKg?: number;
    pickup?: { actualWeightKg?: number; receiptCode?: string };
  };
  currentStep: { id: string; label: string; description?: string; orderStatus?: string };
  nextStep: { id: string; label: string } | null;
  steps: { id: string; label: string; description?: string; orderStatus?: string }[];
  progress: number;
  isComplete: boolean;
  canSkipIroning: boolean;
  isJobAccepted?: boolean;
  assignedStaffId?: string;
  processing?: {
    verifiedWeightKg?: number;
    ironingSkipped?: boolean;
    completedSteps?: { stepId: string; photoUrl?: string; tagCode?: string }[];
  };
}
