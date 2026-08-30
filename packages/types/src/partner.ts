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

export interface BranchHoliday {
  /** ISO date (YYYY-MM-DD) for a one-off holiday, or "MM-DD" when `recurring` is true. */
  date: string;
  label?: string;
  /** When true, `date` is "MM-DD" and recurs every year (e.g. a partner's own yearly closure). */
  recurring?: boolean;
  /** 'closed' (default) marks the date as a holiday. 'open' overrides a recurring/built-in
   * regular holiday to force the shop open on that specific date. */
  type?: 'closed' | 'open';
}

/** Mirrors packages/utils/src/booking.ts's BranchPricingMode — duplicated here (not imported)
 * so packages/types consumers (e.g. PartnerReceivingView) don't need a @lunara/utils dependency. */
export enum BranchPricingMode {
  FLAT_BAG = 'flat_bag',
  PER_KG = 'per_kg',
  PER_LOAD = 'per_load',
  PER_PIECE = 'per_piece',
}

export interface PricingModeRates {
  basePricePerKg?: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  minWeightKg?: number;
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
  isMainShop?: boolean;
  logoUrl?: string;
  maxActiveOrders: number;
  maxWeightCapacityKg: number;
  dailyQuotaOrders: number;
  dailyQuotaWeightKg: number;
  serviceRadiusKm: number;
  operatingHours: OperatingHours;
  /** This branch's own holidays, or (see `holidaysInherited`) the partner's main-shop holidays. */
  holidays: BranchHoliday[];
  /** True when `holidays` was inherited from the partner's main shop because this branch hasn't
   * defined its own override list. */
  holidaysInherited: boolean;
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
  revenue: {
    today: number;
    week: number;
    todayOrders: number;
    weekOrders: number;
    todayPayout: number;
    weekPayout: number;
    series: { date: string; revenue: number }[];
  };
  services: { key: string; label: string; count: number }[];
  trends: {
    ordersToday: PartnerDashboardTrend;
    completedToday: PartnerDashboardTrend;
    revenueToday: PartnerDashboardTrend;
    staffMembers: PartnerDashboardTrend;
  };
  recentOrders: PartnerOrderSummary[];
}

export interface PartnerDashboardTrend {
  value: number;
  deltaPct: number | null;
}

export interface PartnerOrderSummary {
  _id: string;
  bookingType: BookingType | string;
  status: OrderStatus | string;
  total: number;
  branchName?: string;
  branchId?: string;
  currentStepLabel?: string;
  assignedStaffId?: string;
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
  subscriptionId?: string;
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
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  canManageSettings?: boolean;
}

export interface PartnerOwnProfile {
  displayName?: string;
  avatarUrl?: string;
  canManageSettings?: boolean;
  phone?: string;
  email?: string;
}

export interface PartnerAssignedRider {
  _id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  vehicleType?: string;
  plateNumber?: string;
  isOnline: boolean;
  shiftStatus?: string;
}

export interface PartnerBranchRider {
  branchId: string;
  branchName: string;
  branchCode: string;
  rider: PartnerAssignedRider | null;
}

/** A rider the partner has added and owns directly (see Rider.partnerId) — distinct from
 * PartnerAssignedRider, which is just a branch's single default pickup/delivery rider. */
export interface PartnerOwnedRider {
  _id: string;
  userId: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  vehicleType?: string;
  plateNumber?: string;
  orCrNumber?: string;
  employmentType?: 'employee' | 'independent_contractor';
  fixedWageAmount?: number;
  wageFrequency?: 'daily' | 'weekly' | 'monthly';
  isOnline: boolean;
  shiftStatus?: string;
  verificationStatus?: string;
}

export interface PartnerInventoryItem {
  _id: string;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  isLowStock?: boolean;
  /** Units auto-deducted from stock once per completed order. 0 = not auto-tracked. */
  usagePerOrder: number;
  /** Units auto-deducted from stock per kg of verified laundry weight on a completed order. 0 = not auto-tracked. */
  usagePerKg: number;
}

export interface PartnerReportBranchBreakdown {
  branchId: string;
  branchName: string;
  branchCode: string;
  totalOrders: number;
  completedOrders: number;
  revenue: number;
  payout: number;
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
  byBranch?: PartnerReportBranchBreakdown[];
}

export interface PartnerRevenueDailyPoint {
  date: string;
  revenue: number;
  payout: number;
  orders: number;
}

export interface PartnerRevenueBranchBreakdown {
  branchId: string;
  branchName: string;
  branchCode: string;
  monthOrders: number;
  monthRevenue: number;
  monthPayout: number;
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
  byBranch?: PartnerRevenueBranchBreakdown[];
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
  clawbackTotal?: number;
  clawbackOrderCount?: number;
  clawbackRecovered?: number;
  clawbackRecoveryApplied?: number;
  riderCostRecovered?: number;
  createdAt: string;
}

/** Partner-owes-Lunara commission billing — replaces the legacy PartnerSettlement
 * (Lunara-pays-partner payout) now that partners collect payment directly from customers. */
export interface PartnerInvoice {
  _id: string;
  partnerId: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  cashOrders: number;
  digitalOrders: number;
  totalCollected: number;
  commissionDue: number;
  riderCostDue: number;
  amountDue: number;
  commissionRate: number;
  status: 'pending' | 'paid' | 'void';
  dueDate?: string;
  paidAt?: string;
  paidBy?: string;
  paymentReference?: string;
  adminNote?: string;
  creditTotal?: number;
  creditOrderCount?: number;
  creditRecovered?: number;
  creditApplied?: number;
  pdfGeneratedAt?: string;
  emailedAt?: string;
  emailError?: string;
  createdAt: string;
}

export interface PartnerInvoiceOrder {
  orderId: string;
  completedAt: string;
  amount: number;
  subtotal?: number;
  commissionDue?: number;
  commissionRate?: number;
  bookingType: string;
  paymentMethod: string | null;
  cashTiming: 'pickup' | 'delivery' | null;
  cashCollected: boolean;
  cashCollectedAt?: string | null;
  receiptCode?: string | null;
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
    estimatedLoadCount?: number;
    estimatedPieceCount?: number;
    branchName?: string;
    pickup?: {
      actualWeightKg?: number;
      actualLoadCount?: number;
      actualPieceCount?: number;
      receiptCode?: string;
    };
    /** How the base service is billed for this order — see BranchPricingMode. Unset/'flat_bag'
     * orders finalize price at booking time; other modes finalize once shop receiving confirms
     * actual weight/load/piece count (see finalTotal below). */
    pricingMode?: BranchPricingMode;
    /** Set once shop receiving finalizes pricing (PER_KG/PER_LOAD/PER_PIECE orders only). */
    finalServiceSubtotal?: number;
    finalTotal?: number;
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

export interface PartnerTerritory {
  _id: string;
  partnerId: string;
  name: string;
  slug: string;
  boundaryType: 'radius' | 'polygon';
  center?: { type: string; coordinates: [number, number] };
  radiusKm?: number;
  boundary?: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  isExclusive: boolean;
  status: 'active' | 'pending' | 'suspended';
  primaryContactName?: string;
  primaryContactPhone?: string;
  opsNotes?: string;
  createdAt: string;
  updatedAt: string;
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
    items?: { serviceType: string; quantity: number; unitPrice: number; notes?: string }[];
    subtotal?: number;
    discount?: number;
    deliveryFee?: number;
    couponCode?: string;
    scheduledPickupAt?: string;
    scheduledDeliveryAt?: string;
    estimatedWeightKg?: number;
    fulfillmentType?: 'delivery' | 'customer_pickup';
    customerPickupAt?: string;
    subscriptionId?: string;
    pickup?: { actualWeightKg?: number; receiptCode?: string; droppedAtShop?: string };
    paymentMethod?: string;
    paymentLabel?: string;
    customerName?: string;
    customerPhone?: string;
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

export interface PartnerShelfItem {
  _id: string;
  name: string;
  quantity: number;
  note?: string;
  createdAt: string;
}

export interface PartnerShelf {
  _id: string;
  branchId: string;
  name: string;
  items: PartnerShelfItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PartnerCustomerSummary {
  customerId: string;
  name: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
}

export interface PartnerCustomerDetail {
  customerId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
  customerSince: string | null;
}

export interface PartnerShelfItemSearchResult {
  shelfId: string;
  shelfName: string;
  itemId: string;
  name: string;
  quantity: number;
  note?: string;
}
