export interface PickupOffer {
  _id: string;
  status: string;
  bookingType: string;
  scheduledPickupAt?: string;
  pickupAddress?: { label: string; city: string } | null;
}

export interface DeliveryOffer {
  _id: string;
  status: string;
  bookingType: string;
  deliveryAddress?: { label: string; city: string } | null;
}

export interface Task {
  _id: string;
  status: string;
  bookingType: string;
  branchName?: string;
  leg?: 'pickup' | 'delivery';
  pickup?: {
    acceptedAt?: string;
    arrivedAt?: string;
    collectedAt?: string;
    droppedAtShop?: string;
  };
  delivery?: {
    acceptedAt?: string;
    pickedUpFromShopAt?: string;
    startedAt?: string;
  };
  pickupAddress?: { label: string; city: string } | null;
  deliveryAddress?: { label: string; city: string } | null;
}

export interface ActiveAssignment {
  orderId: string;
  orderNumber: string;
  customerName?: string;
  bookingType: string;
  serviceType: string;
  status: string;
  leg: 'pickup' | 'delivery';
  distanceKm: number | null;
  distanceLabel: string;
  etaMinutes: number | null;
  etaLabel: string;
  workflowStep: number;
  workflowTotal: number;
  workflowLabel: string;
  navigateTarget: {
    line1: string;
    city: string;
    province?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface TaskHistoryItem {
  _id: string;
  status: string;
  bookingType: string;
  branchName?: string;
  completedAt: string;
  leg: 'pickup' | 'delivery';
}

export interface CancelledTaskItem {
  _id: string;
  status: string;
  bookingType: string;
  branchName?: string;
  cancelledAt: string;
  leg: 'pickup' | 'delivery';
}

export const RIDER_DOCUMENT_TYPES = [
  'drivers_license',
  'or_cr',
  'nbi_clearance',
  'selfie',
] as const;

export type RiderDocumentType = (typeof RIDER_DOCUMENT_TYPES)[number];

export const RIDER_DOCUMENT_LABELS: Record<RiderDocumentType, string> = {
  drivers_license: "Driver's License",
  or_cr: 'OR/CR',
  nbi_clearance: 'NBI Clearance',
  selfie: 'Selfie Verification',
};

export type RiderDocumentStatus = 'pending' | 'approved' | 'rejected';

export interface RiderKycDocument {
  type: RiderDocumentType;
  fileUrl?: string;
  status?: RiderDocumentStatus;
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface RiderHomeAddress {
  line1?: string;
  line2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
}

export interface RiderCompliance {
  isCompliant: boolean;
  profileGaps: string[];
  documentGaps: string[];
  approvedDocumentCount: number;
  verificationStatus: 'incomplete' | 'pending_review' | 'verified';
}

export type ShiftStatus = 'offline' | 'online' | 'break';

export interface RiderMe {
  userId?: string;
  riderId?: string;
  /** Set when this rider was added by a partner (partner-web) — their pay is managed entirely by
   * that partner, outside the platform wallet, so wallet/withdrawal screens don't apply. */
  partnerId?: string | null;
  isOnline: boolean;
  shiftStatus?: ShiftStatus;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  homeAddress?: RiderHomeAddress | null;
  vehicleType?: string;
  plateNumber?: string;
  orCrNumber?: string;
  employmentType?: 'employee' | 'independent_contractor';
  /** Flat per-leg fee the rider is paid — only sent (non-null) for a non-employee, platform-pooled
   * rider (no partnerId), since a salaried employee isn't paid per task and a partner-owned rider
   * isn't paid through the platform wallet at all. */
  feeRates?: { pickup: number; delivery: number } | null;
  documents?: RiderKycDocument[];
  compliance?: RiderCompliance;
  totalEarnings: number;
  todayEarnings: number;
  shopLocation?: {
    name: string;
    line1: string;
    city: string;
    province: string;
    latitude?: number;
    longitude?: number;
  };
  user?: { firstName: string; lastName: string; email?: string; phone?: string } | null;
}

export interface EarningsData {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  lifetimeEarnings: number;
  totalEarnings: number;
  todayPickups: number;
  todayDeliveries: number;
  recentEarnings: {
    type: 'pickup' | 'delivery' | 'bonus' | 'adjustment' | 'wage';
    amount: number;
    orderId?: string;
    note?: string;
    earnedAt: string;
  }[];
  employmentType?: 'employee' | 'independent_contractor';
  /** Flat per-leg fee rates — only present for a non-employee, platform-pooled rider. */
  feeRates?: { pickup: number; delivery: number } | null;
}

export interface RiderPerformanceData {
  completionRate: number;
  acceptanceRate: number;
  onTimeDeliveryRate: number;
  customerRating: number | null;
  completedTasks: number;
  cancelledTasks: number;
  acceptedAssignments: number;
  totalAssignments: number;
  onTimeDeliveries: number;
  ratedDeliveries: number;
}

export type RiderPayoutMethod = 'gcash' | 'maya' | 'bank';

export interface PayoutMethodData {
  method: RiderPayoutMethod | null;
  label?: string;
  configured: boolean;
  gcashNumber?: string;
  mayaNumber?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
}

export interface WalletTransaction {
  type: 'credit' | 'debit' | 'hold' | 'release';
  amount: number;
  reference: string;
  description: string;
  createdAt: string;
}

export interface WalletData {
  currentBalance: number;
  pendingEarnings: number;
  withdrawableBalance: number;
  currency: string;
  minWithdrawal: number;
  pendingWithdrawalTotal: number;
  payoutMethod: PayoutMethodData;
  recentTransactions: WalletTransaction[];
}

export interface WithdrawalRequest {
  _id: string;
  amount: number;
  method: RiderPayoutMethod;
  methodLabel: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  statusLabel: string;
  adminNote?: string;
  processedAt?: string;
  createdAt: string;
}

export interface CashRemittanceItem {
  _id: string;
  orderId: string;
  stage: 'pickup' | 'delivery';
  cashAmount: number;
  earningOffset: number;
  netRemittance: number;
  remittanceMode: 'net_of_fee' | 'full_amount';
  status: 'pending' | 'submitted' | 'remitted';
  submittedAt?: string;
  remittedAt?: string;
  createdAt: string;
}

export interface CashSummaryData {
  pendingRemittance: {
    count: number;
    totalCashCollected: number;
    totalEarningOffset: number;
    totalNetRemittance: number;
    items: CashRemittanceItem[];
  };
  recentRemitted: CashRemittanceItem[];
}

export const VEHICLE_TYPES = ['motorcycle', 'bicycle', 'car', 'van'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];
