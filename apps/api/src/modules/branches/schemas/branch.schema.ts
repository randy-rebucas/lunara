import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BookingType } from '@lunara/types';
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

@Schema({ _id: false })
class BranchServicePrice {
  @Prop({ required: true, enum: BookingType })
  serviceType!: BookingType;

  /** Shop's own price per kg, before Lunara's customer-facing markup. */
  @Prop({ required: true, min: 0 })
  basePricePerKg!: number;
}

@Schema({ _id: false })
class BranchAddonPrice {
  /** LaundryAddon.slug */
  @Prop({ required: true })
  addonSlug!: string;

  /** Shop's own add-on price, before Lunara's customer-facing markup. */
  @Prop({ required: true, min: 0 })
  basePrice!: number;
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

  /** Platform commission rate on laundry subtotal (0–1). Default 20%. */
  @Prop({ default: 0.20, min: 0, max: 1 })
  commissionRate!: number;

  /** This shop's own price per kg per service; falls back to the global catalog price when a type is missing. */
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

  @Prop({ type: PartnerPortalSettings, default: () => ({ ...DEFAULT_PARTNER_PORTAL_SETTINGS }) })
  portalSettings!: PartnerPortalSettings;

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
