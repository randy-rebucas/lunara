import type { BookingType, OrderStatus, UserRole } from './enums.js';

export type PortalRole = UserRole.PARTNER | UserRole.STAFF | UserRole.ADMIN;

export interface PortalUser {
  email?: string;
  role: PortalRole;
  branchId?: string;
}

export interface PartnerDashboardData {
  counts: {
    incoming: number;
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
}

export interface PartnerStaffMember {
  _id: string;
  email?: string;
  phone?: string;
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

export interface PartnerRevenueData {
  today: number;
  month: number;
  todayOrders: number;
  monthOrders: number;
  allTimeCompletedOrders: number;
  daily: { date: string; revenue: number; orders: number }[];
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
