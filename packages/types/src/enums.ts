export enum UserRole {
  CUSTOMER = 'customer',
  RIDER = 'rider',
  PARTNER = 'partner',
  STAFF = 'staff',
  ADMIN = 'admin',
  /** Self-service app-builder account — claimed a white-label app design via
   *  POST /public/app-configs/claim. Distinct from PARTNER (an operating laundry shop). */
  BRAND_OWNER = 'brand_owner',
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
  IRONING = 'ironing',
  RUGS = 'rugs',
  UPHOLSTERY = 'upholstery',
  BAGS = 'bags',
  LEATHER = 'leather',
  ALTERATION = 'alteration',
  PREMIUM_WASH_FOLD = 'premium_wash_fold',
  BABY_CLOTHES_WASH = 'baby_clothes_wash',
  DELICATES_WASH = 'delicates_wash',
  COLOR_SEPARATION_WASH = 'color_separation_wash',
  WHITE_GARMENTS_WASH = 'white_garments_wash',
  HAND_WASH = 'hand_wash',
  MACHINE_WASH = 'machine_wash',
  ECO_FRIENDLY_WASH = 'eco_friendly_wash',
  HYPOALLERGENIC_WASH = 'hypoallergenic_wash',
  SANITIZING_DISINFECTION = 'sanitizing_disinfection',
  WEDDING_GOWN_PRESERVATION = 'wedding_gown_preservation',
  SPECIALTY_ITEMS = 'specialty_items',
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

export enum ServiceCategory {
  CORE_LAUNDRY = 'core_laundry',
  GARMENT_CARE = 'garment_care',
  HOME_TEXTILES = 'home_textiles',
  FOOTWEAR_LEATHER = 'footwear_leather',
  WELLNESS_SANITATION = 'wellness_sanitation',
  SPECIALTY = 'specialty',
}

export enum AddonCategory {
  TREATMENT = 'treatment',
  PROTECTION = 'protection',
  FINISHING = 'finishing',
  SPEED = 'speed',
  REPAIR = 'repair',
}
