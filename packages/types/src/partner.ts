import type { BookingType, OrderStatus, UserRole } from './enums.js';

export type PortalRole = UserRole.PARTNER | UserRole.STAFF | UserRole.ADMIN;

export interface PortalUser {
  email?: string;
  role: PortalRole;
  branchId?: string;
}

export interface DayOperatingHours {
  isClosed: boolean;
  /** 24h "HH:mm", e.g. "08:00" */
  openTime: string;
  /** 24h "HH:mm", e.g. "17:00" */
  closeTime: string;
}

/** Length 7, index = JS `Date.getDay()` (0 = Sunday … 6 = Saturday). */
export type OperatingHours = DayOperatingHours[];

export interface PartnerPortalSettings {
  acceptingOrders: boolean;
  autoAcceptIncoming: boolean;
  notifyNewOrders: boolean;
  notifyPickupArriving: boolean;
  notifyLowStock: boolean;
  notifyReadyForDelivery: boolean;
  allowStaffToRequestDelivery: boolean;
  requireWeightVerificationOnReceive: boolean;
  inventoryEnabled: boolean;
  payoutMethod?: 'gcash' | 'maya' | 'bank' | 'counter' | null;
  gcashNumber?: string | null;
  mayaNumber?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
}

export interface PartnerShopBranchSummary {
  id: string;
  code: string;
  name: string;
  line1: string;
  city: string;
  province: string;
  isActive: boolean;
  logoUrl?: string;
  maxActiveOrders: number;
  maxWeightCapacityKg: number;
  dailyQuotaOrders: number;
  dailyQuotaWeightKg: number;
  serviceRadiusKm: number;
  operatingHours: OperatingHours;
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
  revenue: { today: number; week: number; todayOrders: number; weekOrders: number; todayPayout: number; weekPayout: number };
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
  currentStepId: string;
  currentStepLabel: string;
  progress: number;
  assignedStaffId?: string;
  isAssigned?: boolean;
  branchId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentLabel?: string;
}

export interface PartnerStaffMember {
  _id: string;
  email?: string;
  phone?: string;
  role?: string;
  createdAt?: string;
  activeJobs: number;
  displayName?: string;
  avatarUrl?: string;
}

export interface PartnerOwnProfile {
  displayName?: string;
  avatarUrl?: string;
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
  payout: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  completedByService: Record<string, number>;
}

export interface PartnerRevenueDailyPoint {
  date: string;
  revenue: number;
  payout: number;
  orders: number;
}

export interface PartnerRevenueData {
  today: number;
  todayFee: number;
  todayPayout: number;
  week: number;
  weekFee: number;
  weekPayout: number;
  month: number;
  monthFee: number;
  monthPayout: number;
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  avgOrderToday: number;
  avgOrderMonth: number;
  allTimeCompletedOrders: number;
  allTimeRevenue: number;
  allTimeFee: number;
  allTimePayout: number;
  daily: PartnerRevenueDailyPoint[];
  recentOrders: PartnerOrderDetail[];
}

export interface PartnerSettlement {
  _id: string;
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  cashOrders: number;
  digitalOrders: number;
  totalAmount: number;
  lunaraFee: number;
  partnerPayout: number;
  commissionRate: number;
  status: 'pending' | 'paid';
  paidAt?: string;
  paidBy?: string;
  adminNote?: string;
  createdAt: string;
}

export interface PartnerOrderDetail {
  orderId: string;
  completedAt: string;
  amount: number;
  subtotal?: number;
  lunaraFee?: number;
  partnerPayout?: number;
  commissionRate?: number;
  bookingType: string;
  paymentMethod: string | null;
  cashTiming: 'pickup' | 'delivery' | null;
  cashCollected: boolean;
  cashCollectedAt: string | null;
  receiptCode: string | null;
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

export interface PartnerBrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  destructive: string;
}

export interface PartnerBrandFonts {
  sans: string;
  heading?: string;
}

export interface PartnerBrandConfig {
  domain?: string;
  customDomainVerified: boolean;
  appDisplayName: string;
  colors: PartnerBrandColors;
  fonts: PartnerBrandFonts;
  logoUrl?: string;
  iconUrl?: string;
  splashUrl?: string;
  faviconUrl?: string;
  mobileBundleId?: { ios?: string; android?: string };
  status: 'draft' | 'pending_review' | 'live';
}

export interface RecipientInfo {
  email: string | null;
  phone: string | null;
  branchName: string | null;
  branchCode: string | null;
  city: string | null;
  province: string | null;
  line1: string | null;
}

export interface ConversationDetail {
  _id: string;
  partnerId: string;
  unreadCount: number;
  recipient: RecipientInfo;
  createdAt: string;
}

export interface MessageAttachment {
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  content: string;
  attachments: MessageAttachment[];
  createdAt: string;
  readAt?: string;
}

export interface PartnerConversation {
  _id: string;
  partnerId: string;
  subject?: string;
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
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
    fulfillmentType?: 'delivery' | 'customer_pickup';
    customerPickupAt?: string;
    pickup?: { actualWeightKg?: number; receiptCode?: string; droppedAtShop?: string };
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
    completedSteps?: { stepId: string; photoUrl?: string }[];
    shelfSlot?: string;
    tagId?: string;
    tagCode?: string;
  };
}

export interface PartnerShelfLookupResult {
  orderId: string;
  status: string;
  shelfSlot?: string;
  currentStepId: string | null;
  currentStepLabel?: string;
  customerName?: string;
  customerPhone?: string;
}
