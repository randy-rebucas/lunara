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

  reviewedBy?: string;

  rejectionReason?: string;

}



export interface RiderHomeAddress {

  line1?: string;

  line2?: string;

  city?: string;

  province?: string;

  postalCode?: string;

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

  isOnline: boolean;

  shiftStatus?: ShiftStatus;

  firstName?: string;

  lastName?: string;

  homeAddress?: RiderHomeAddress | null;

  vehicleType?: string;

  plateNumber?: string;

  orCrNumber?: string;

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

    type: 'pickup' | 'delivery' | 'bonus' | 'adjustment';

    amount: number;

    orderId?: string;

    note?: string;

    earnedAt: string;

  }[];

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



export const VEHICLE_TYPES = ['motorcycle', 'bicycle', 'car', 'van'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];


