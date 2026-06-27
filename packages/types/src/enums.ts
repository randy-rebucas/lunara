export enum UserRole {
  CUSTOMER = 'customer',
  RIDER = 'rider',
  PARTNER = 'partner',
  STAFF = 'staff',
  ADMIN = 'admin',
}

export enum OrderStatus {
  PENDING = 'pending',
  /** Paid; awaiting Lunara admin to assign laundry shop */
  PENDING_DISPATCH = 'pending_dispatch',
  /** Admin assigned laundry shop; partner acceptance / pickup next */
  SHOP_ASSIGNED = 'shop_assigned',
  /** @deprecated Prefer SHOP_ASSIGNED — kept for legacy records */
  CONFIRMED = 'confirmed',
  /** Pickup rider assigned by admin (or confirmed from suggestion) */
  RIDER_ASSIGNED_PICKUP = 'rider_assigned_pickup',
  /** @deprecated Use RIDER_ASSIGNED_PICKUP for pickup phase */
  RIDER_ASSIGNED = 'rider_assigned',
  PICKED_UP = 'picked_up',
  /** Rider en route to / delivered laundry at assigned shop */
  IN_TRANSIT_TO_SHOP = 'in_transit_to_shop',
  /** Partner confirmed intake (receive, weight, items) */
  RECEIVED_AT_SHOP = 'received_at_shop',
  RECEIVED = 'received',
  SORTING = 'sorting',
  WASHING = 'washing',
  DRYING = 'drying',
  FOLDING = 'folding',
  IRONING = 'ironing',
  QUALITY_CHECK = 'quality_check',
  READY_FOR_DELIVERY = 'ready_for_delivery',
  /** Customer chose to collect laundry at the shop themselves */
  CUSTOMER_PICKUP = 'customer_pickup',
  /** Delivery rider assigned by admin dispatcher */
  RIDER_ASSIGNED_DELIVERY = 'rider_assigned_delivery',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum BookingType {
  WASH_FOLD = 'wash_fold',
  WASH_DRY = 'wash_dry',
  WASH_DRY_FOLD = 'wash_dry_fold',
  WASH_DRY_FOLD_IRON = 'wash_dry_fold_iron',
  DRY_CLEANING = 'dry_cleaning',
  COMFORTERS = 'comforters',
  CURTAINS = 'curtains',
  SHOES = 'shoes',
  UNIFORMS = 'uniforms',
}

export enum PaymentMethod {
  WALLET = 'wallet',
  GCASH = 'gcash',
  MAYA = 'maya',
  STRIPE = 'stripe',
  CASH = 'cash',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum NotificationChannel {
  PUSH = 'push',
  SMS = 'sms',
  EMAIL = 'email',
  IN_APP = 'in_app',
}

export enum PushPlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

export enum AddressType {
  HOME = 'home',
  WORK = 'work',
  APARTMENT = 'apartment',
  OTHER = 'other',
}

export enum PromotionAudience {
  ALL = 'all',
  NEW_CUSTOMERS = 'new_customers',
}

export enum PromotionKind {
  STANDARD = 'standard',
  SIGNUP_TEMPLATE = 'signup_template',
}
