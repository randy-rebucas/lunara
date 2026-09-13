import type {
  NotificationChannel,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from './enums.js';

export interface BaseDocument {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface User extends BaseDocument {
  email?: string;
  phone?: string;
  role: UserRole;
  branchId?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface CustomerProfile extends BaseDocument {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  loyaltyPoints: number;
}

export interface UserProfile extends BaseDocument {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface Address extends BaseDocument {
  userId: string;
  label: string;
  addressType?: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

/** Shape returned by GET/POST/PATCH /addresses — a raw Mongoose document (`_id`, no `id` alias). */
export interface CustomerAddress {
  _id: string;
  label: string;
  addressType?: string;
  line1: string;
  line2?: string;
  landmark?: string;
  /** Default note for the rider/shop at this address (gate code, "leave with guard", etc). */
  deliveryInstructions?: string;
  city: string;
  province: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

export interface FavoriteBranch {
  branchId: string;
  code: string;
  name: string;
  city: string;
  logoUrl?: string;
  favoritedAt: string;
}

export interface BusinessSummaryMonth {
  month: string;
  orderCount: number;
  totalSpend: number;
}

export interface BusinessSummary {
  months: BusinessSummaryMonth[];
  totalOrders: number;
  totalSpend: number;
}

export interface ImpactSummary {
  totalWeightKg: number;
  orderCount: number;
  estimatedCo2SavedKg: number;
}

export interface Wallet extends BaseDocument {
  userId: string;
  balance: number;
  currency: string;
}

export interface Transaction extends BaseDocument {
  walletId: string;
  type: 'credit' | 'debit';
  amount: number;
  reference: string;
  description: string;
}

export type PaymentPurpose = 'order' | 'wallet_topup';

export interface Payment extends BaseDocument {
  orderId?: string;
  purpose?: PaymentPurpose;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  externalId?: string;
  paymongoSessionId?: string;
  receiptCode?: string;
  cashTiming?: 'pickup' | 'delivery';
  paidAt?: string;
  checkoutUrl?: string;
}

export interface Notification extends BaseDocument {
  userId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  read: boolean;
  data?: Record<string, unknown>;
}

export interface Review extends BaseDocument {
  orderId: string;
  customerId: string;
  partnerId: string;
  rating: number;
  comment?: string;
}

export interface Deal {
  _id: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  startsAt?: string;
  endsAt?: string;
  expiresAt?: string;
  isPersonal?: boolean;
  audience?: 'all' | 'new_customers';
  /** Set only for a partner-created deal — undefined for a platform-wide one. */
  partnerId?: string;
}

export interface RiderCashRemittance {
  _id: string;
  riderUserId: string;
  orderId: string;
  paymentId: string;
  stage: 'pickup' | 'delivery';
  cashAmount: number;
  earningOffset: number;
  netRemittance: number;
  status: 'pending' | 'remitted';
  remittedAt?: string;
  verifiedBy?: string;
  createdAt: string;
}

export interface RiderCashSummary {
  pendingRemittance: {
    count: number;
    totalCashCollected: number;
    totalEarningOffset: number;
    totalNetRemittance: number;
    items: RiderCashRemittance[];
  };
  recentRemitted: RiderCashRemittance[];
}

export interface CustomerPromo {
  _id: string;
  userId: string;
  code: string;
  title: string;
  description?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  expiresAt: string;
  redeemedAt?: string;
  orderId?: string;
  sourcePromotionId?: string;
  createdAt: string;
}
