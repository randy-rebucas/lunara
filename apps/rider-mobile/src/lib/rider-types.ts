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
}

export type ShiftStatus = 'offline' | 'online' | 'break';

export interface RiderMe {
  userId?: string;
  riderId?: string;
  /** Set when this rider was added by a partner (partner-web) — their pay is managed entirely by
   * that partner, outside the platform wallet. */
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
  /** Only meaningful for a partner-owned rider (partnerId set) — gates task assignment. A rider
   * stays 'onboarding' until their partner approves all documents, sets payout, and activates them. */
  employmentStatus?: 'onboarding' | 'active' | 'suspended' | 'terminated';
  compliance?: RiderCompliance;
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

export const VEHICLE_TYPES = ['motorcycle', 'bicycle', 'car', 'van'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];
