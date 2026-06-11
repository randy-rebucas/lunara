import type {
  BookingType,
  NotificationChannel,
  OrderStatus,
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

export interface OrderItem {
  serviceType: BookingType;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface Order extends BaseDocument {
  customerId: string;
  partnerId?: string;
  pickupRiderId?: string;
  deliveryRiderId?: string;
  status: OrderStatus;
  bookingType: BookingType;
  items: OrderItem[];
  pickupAddressId: string;
  deliveryAddressId: string;
  scheduledPickupAt: string;
  scheduledDeliveryAt?: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  couponCode?: string;
  statusHistory: OrderStatusEvent[];
}

export interface OrderStatusEvent {
  status: OrderStatus;
  timestamp: string;
  note?: string;
  updatedBy?: string;
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
