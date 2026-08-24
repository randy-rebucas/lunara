import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BookingType } from '@lunara/types';
import { BranchPricingMode, DEFAULT_OPERATING_HOURS } from '@lunara/utils';
import { HydratedDocument, Types } from 'mongoose';

export type BranchDocument = HydratedDocument<Branch>;

@Schema({ _id: false })
export class PartnerPortalSettings {
  /** When false, the shop should not receive new customer orders via dispatch */
  @Prop({ default: true })
  acceptingOrders!: boolean;

  /** Automatically accept incoming shop-assigned orders without manual review */
  @Prop({ default: false })
  autoAcceptIncoming!: boolean;

  @Prop({ default: true })
  notifyNewOrders!: boolean;

  @Prop({ default: true })
  notifyPickupArriving!: boolean;

  @Prop({ default: true })
  notifyLowStock!: boolean;

  @Prop({ default: true })
  notifyReadyForDelivery!: boolean;

  /** Staff may request rider delivery from the processing queue */
  @Prop({ default: true })
  allowStaffToRequestDelivery!: boolean;

  /** Require weight verification step during shop receiving */
  @Prop({ default: true })
  requireWeightVerificationOnReceive!: boolean;

  /** Whether this shop tracks supply inventory; shops that don't sell products can disable this */
  @Prop({ default: true })
  inventoryEnabled!: boolean;

  /** Preferred payout channel: gcash | maya | bank | counter */
  @Prop({ type: String, default: null })
  payoutMethod?: string | null;

  @Prop({ type: String, default: null })
  gcashNumber?: string | null;

  @Prop({ type: String, default: null })
  mayaNumber?: string | null;

  @Prop({ type: String, default: null })
  bankName?: string | null;

  @Prop({ type: String, default: null })
  bankAccountName?: string | null;

  @Prop({ type: String, default: null })
  bankAccountNumber?: string | null;
}

export const DEFAULT_PARTNER_PORTAL_SETTINGS: PartnerPortalSettings = {
  acceptingOrders: true,
  autoAcceptIncoming: false,
  notifyNewOrders: true,
  notifyPickupArriving: true,
  notifyLowStock: true,
  notifyReadyForDelivery: true,
  allowStaffToRequestDelivery: true,
  requireWeightVerificationOnReceive: true,
  inventoryEnabled: true,
};

@Schema({ _id: false })
export class DayOperatingHours {
  @Prop({ default: false })
  isClosed!: boolean;

  @Prop({ default: '08:00' })
  openTime!: string;

  @Prop({ default: '17:00' })
  closeTime!: string;
}

@Schema({ _id: false })
export class BranchHoliday {
  /** ISO date (YYYY-MM-DD), no time component — shop is fully closed this calendar day. */
  @Prop({ required: true })
  date!: string;

  @Prop()
  label?: string;
}

@Schema({ _id: false })
class BranchMachine {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true, enum: ['washer', 'dryer', 'folder', 'press', 'other'] })
  machineType!: string;

  @Prop({ default: 'active', enum: ['active', 'maintenance', 'offline'] })
  status!: string;

  @Prop({ default: 8 })
  capacityKg!: number;
}

export { BranchPricingMode };

@Schema({ _id: false })
class BranchServicePrice {
  @Prop({ required: true, enum: BookingType })
  serviceType!: BookingType;

  /** Shop's own price per kg, before Lunara's customer-facing markup. Used when pricingMode = PER_KG. */
  @Prop({ min: 0 })
  basePricePerKg?: number;

  /** Shop's own price per load, before Lunara's customer-facing markup. Used when pricingMode = PER_LOAD. */
  @Prop({ min: 0 })
  basePricePerLoad?: number;

  /** Shop's own price per piece, before Lunara's customer-facing markup. Used when pricingMode = PER_PIECE. */
  @Prop({ min: 0 })
  basePricePerPiece?: number;

  /** Shop's own price per pair, before Lunara's customer-facing markup. Used when pricingMode = PER_PAIR. */
  @Prop({ min: 0 })
  basePricePerPair?: number;

  /** Shop's own price per item, before Lunara's customer-facing markup. Used when pricingMode = PER_ITEM. */
  @Prop({ min: 0 })
  basePricePerItem?: number;

  /** Shop's own flat total, before Lunara's customer-facing markup. Used when pricingMode = FIXED. */
  @Prop({ min: 0 })
  fixedPrice?: number;

  /** How this specific service bills the customer. Falls back to the branch-level `pricingMode`
   * when unset, so branches configured before per-service units existed keep working unchanged. */
  @Prop({ enum: BranchPricingMode })
  pricingUnit?: BranchPricingMode;
}

@Schema({ _id: false })
class BranchAddonPrice {
  /** LaundryAddon.slug */
  @Prop({ required: true })
  addonSlug!: string;

  /** Shop's own add-on price, before Lunara's customer-facing markup. Flat total when
   * pricingUnit is FLAT_BAG (or unset). */
  @Prop({ required: true, min: 0 })
  basePrice!: number;

  /** Shop's own add-on price per kg, before markup. Used when pricingUnit = PER_KG. */
  @Prop({ min: 0 })
  basePricePerKg?: number;

  /** Shop's own add-on price per machine load, before markup. Used when pricingUnit = PER_LOAD. */
  @Prop({ min: 0 })
  basePricePerLoad?: number;

  /** Shop's own add-on price per piece, before markup. Used when pricingUnit = PER_PIECE. */
  @Prop({ min: 0 })
  basePricePerPiece?: number;

  /** Shop's own add-on price per pair, before markup. Used when pricingUnit = PER_PAIR. */
  @Prop({ min: 0 })
  basePricePerPair?: number;

  /** Shop's own add-on price per item, before markup. Used when pricingUnit = PER_ITEM. */
  @Prop({ min: 0 })
  basePricePerItem?: number;

  /** Shop's own flat add-on total, before markup. Used when pricingUnit = FIXED. */
  @Prop({ min: 0 })
  fixedPrice?: number;

  /** How this add-on bills the customer — flat per order, or scaled by weight/load/piece count.
   * Falls back to FLAT_BAG (today's behavior) when unset. */
  @Prop({ enum: BranchPricingMode })
  pricingUnit?: BranchPricingMode;

  /** Booking types this add-on may be attached to at this shop (empty/unset = applies to any service). */
  @Prop({ type: [String], default: [] })
  applicableServiceTypes?: string[];
}

@Schema({ _id: false })
class BranchGarmentPrice {
  /** GARMENT_CATALOG item id (from @lunara/utils). */
  @Prop({ required: true })
  garmentId!: string;

  /** Shop's own price for this garment, charged directly to the customer (garments carry no
   * separate markup step — mirrors GARMENT_CATALOG.price). */
  @Prop({ required: true, min: 0 })
  price!: number;
}

@Schema({ timestamps: true, collection: 'branches' })
export class Branch {
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: ['hq', 'franchise', 'partner_shop'], default: 'partner_shop' })
  branchType!: 'hq' | 'franchise' | 'partner_shop';

  @Prop({ type: Types.ObjectId, index: true })
  parentBranchId?: Types.ObjectId;

  @Prop({ required: true })
  line1!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true })
  province!: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerUserId!: Types.ObjectId;

  /** The PartnerApplication this branch was onboarded from, if any — same traceability as
   * User.sourceApplicationId, set together when onboarding is initiated from an application. */
  @Prop({ type: Types.ObjectId })
  sourceApplicationId?: Types.ObjectId;

  /** The partner's single flagship shop — branches (variants) roll up to it in shop counts and
   * customer-facing listings. Exactly one active branch per partnerUserId may have this set;
   * enforced by the partial unique index below. Server-derived only — see BranchManagementService. */
  @Prop({ default: false })
  isMainShop!: boolean;

  @Prop({ type: Types.ObjectId })
  managerUserId?: Types.ObjectId;

  /** Default/preferred rider for pickups & deliveries dispatched from this branch. */
  @Prop({ type: Types.ObjectId })
  assignedRiderId?: Types.ObjectId;

  @Prop({ default: 25 })
  maxActiveOrders!: number;

  @Prop({ default: 200 })
  maxWeightCapacityKg!: number;

  @Prop({ default: 30 })
  dailyQuotaOrders!: number;

  @Prop({ default: 250 })
  dailyQuotaWeightKg!: number;

  @Prop({ default: 15 })
  serviceRadiusKm!: number;

  @Prop({ type: [BranchMachine], default: [] })
  machines!: BranchMachine[];

  @Prop({ default: true })
  isActive!: boolean;

  /** Shop logo shown in customer/partner-facing UI. Public URL. */
  @Prop()
  logoUrl?: string;

  /** Platform commission rate on laundry subtotal (0–1). Default 20%. */
  @Prop({ default: 0.20, min: 0, max: 1 })
  commissionRate!: number;

  /** How this shop bills the customer for the base laundry service. Defaults to the platform-wide flat bag pricing. */
  @Prop({ default: BranchPricingMode.FLAT_BAG, enum: BranchPricingMode })
  pricingMode!: BranchPricingMode;

  /** kg per machine load for this shop's PER_LOAD pricing/estimation. Undefined = "use the platform
   * default" (BOOKING_MACHINE_LOAD_MIN_KG) — resolved in the service layer, never a schema default, so
   * every pre-existing branch needs zero migration and "not set" stays distinguishable from "set to 8". */
  @Prop({ min: 1 })
  kgPerLoad?: number;

  /** This shop's own price per kg/load per service; falls back to the global catalog price when a type is missing. */
  @Prop({ type: [BranchServicePrice], default: [] })
  servicePricing!: BranchServicePrice[];

  /** This shop's own price per add-on; falls back to the global catalog price when a slug is missing. */
  @Prop({ type: [BranchAddonPrice], default: [] })
  addonPricing!: BranchAddonPrice[];

  /** Global catalog BookingType values this shop does not offer. Empty = offers everything active. */
  @Prop({ type: [String], enum: BookingType, default: [] })
  hiddenServiceTypes!: BookingType[];

  /** Global catalog LaundryAddon slugs this shop does not offer. Empty = offers everything active. */
  @Prop({ type: [String], default: [] })
  hiddenAddonSlugs!: string[];

  /** GARMENT_CATALOG item ids (from @lunara/utils) this shop does not do dry cleaning for.
   * Empty = offers every garment. Only meaningful when DRY_CLEANING isn't itself hidden. */
  @Prop({ type: [String], default: [] })
  hiddenGarmentItemIds!: string[];

  /** This shop's own price per garment (dry cleaning); falls back to GARMENT_CATALOG's reference
   * price when a garment id is missing. */
  @Prop({ type: [BranchGarmentPrice], default: [] })
  garmentPricing!: BranchGarmentPrice[];

  @Prop({ type: PartnerPortalSettings, default: () => ({ ...DEFAULT_PARTNER_PORTAL_SETTINGS }) })
  portalSettings!: PartnerPortalSettings;

  /** Weekly schedule, index = JS `Date.getDay()` (0 = Sunday … 6 = Saturday). Defaults to every day 8AM–5PM. */
  @Prop({ type: [DayOperatingHours], default: () => DEFAULT_OPERATING_HOURS.map((d) => ({ ...d })) })
  operatingHours!: DayOperatingHours[];

  /** One-off closed dates (holidays), set per-partner on their main shop and inherited by every
   * branch under that partner unless a branch defines its own (see resolveBranchHolidays in
   * branches.service.ts). Only meaningful when set on the main shop — sub-branches may still set
   * their own to override the inherited list entirely. */
  @Prop({ type: [BranchHoliday], default: [] })
  holidays!: BranchHoliday[];

  @Prop({
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  })
  location!: { type: string; coordinates: [number, number] };

  createdAt!: Date;
  updatedAt!: Date;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
BranchSchema.index({ location: '2dsphere' });
BranchSchema.index(
  { partnerUserId: 1 },
  { unique: true, partialFilterExpression: { isMainShop: true, isActive: true } },
);
