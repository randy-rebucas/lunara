import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BookingType, OrderStatus } from '@lunara/types';
import { BranchPricingMode } from '@lunara/utils';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ _id: false })
class OrderGarmentSelection {
  @Prop({ required: true })
  garmentId!: string;

  @Prop({ required: true })
  quantity!: number;
}

@Schema({ _id: false })
class OrderAddon {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  price!: number;
}

@Schema({ _id: false })
class OrderItem {
  @Prop({ required: true, enum: BookingType })
  serviceType!: BookingType;

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  unitPrice!: number;

  @Prop()
  notes?: string;
}

@Schema({ _id: false })
class OrderPickup {
  @Prop()
  offeredAt?: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  arrivedAt?: Date;

  @Prop()
  customerVerifiedAt?: Date;

  @Prop()
  collectedAt?: Date;

  @Prop()
  photoUrl?: string;

  @Prop()
  receiptCode?: string;

  @Prop()
  actualWeightKg?: number;

  /** PER_LOAD orders only — actual load count confirmed at pickup. */
  @Prop()
  actualLoadCount?: number;

  /** PER_PIECE orders only — actual piece count confirmed at pickup. */
  @Prop()
  actualPieceCount?: number;

  /** When the partner confirmed actual weight/load count and finalized pricing. Unset = still an estimate. */
  @Prop()
  priceConfirmedAt?: Date;

  /** Last 4 digits of customer phone for rider verification. */
  @Prop()
  verificationHint?: string;

  @Prop()
  notes?: string;

  @Prop()
  receiptGeneratedAt?: Date;

  @Prop()
  inTransitToShopAt?: Date;

  @Prop()
  droppedAtShop?: Date;
}

@Schema({ _id: false })
class OrderPricingSnapshot {
  @Prop()
  basePricePerKg?: number;

  @Prop()
  basePricePerLoad?: number;

  @Prop()
  basePricePerPiece?: number;

  @Prop()
  minWeightKg?: number;
}

@Schema({ _id: false })
class ProcessingStepRecord {
  @Prop({ required: true })
  stepId!: string;

  @Prop({ required: true, default: Date.now })
  completedAt!: Date;

  @Prop()
  note?: string;

  @Prop()
  verifiedWeightKg?: number;

  @Prop()
  photoUrl?: string;
}

@Schema({ _id: false })
class OrderDelivery {
  @Prop()
  offeredAt?: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  pickedUpFromShopAt?: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  outForDeliveryAt?: Date;

  @Prop()
  arrivedAt?: Date;

  @Prop()
  customerReceivedAt?: Date;

  @Prop()
  customerVerifiedAt?: Date;

  @Prop()
  customerSignedAt?: Date;

  @Prop()
  signatureName?: string;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  photoUrl?: string;

  @Prop()
  receiptCode?: string;

  @Prop()
  verificationHint?: string;
}

@Schema({ _id: false })
class OrderShopReceiving {
  @Prop()
  receivedAt?: Date;

  @Prop()
  receivedBy?: string;

  @Prop()
  verifiedWeightKg?: number;

  @Prop()
  weightVerifiedAt?: Date;

  @Prop()
  itemCount?: number;

  @Prop()
  itemsConfirmedAt?: Date;

  @Prop()
  confirmedBy?: string;

  @Prop()
  notes?: string;
}

@Schema({ _id: false })
class OrderLaundryProcessing {
  @Prop()
  currentStepId?: string;

  @Prop({ type: [ProcessingStepRecord], default: [] })
  completedSteps!: ProcessingStepRecord[];

  @Prop({ default: false })
  ironingSkipped!: boolean;

  @Prop()
  verifiedWeightKg?: number;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ type: Types.ObjectId })
  assignedStaffId?: Types.ObjectId;

  @Prop()
  assignedAt?: Date;

  @Prop({ type: Types.ObjectId })
  assignedBy?: Types.ObjectId;

  @Prop()
  shelfSlot?: string;

  @Prop()
  shelfAssignedAt?: Date;

  @Prop({ type: Types.ObjectId })
  shelfAssignedBy?: Types.ObjectId;

  /** Reusable physical QR tag assigned at pickup, persists across the whole processing pipeline. */
  @Prop({ type: Types.ObjectId, ref: 'LaundryTag' })
  tagId?: Types.ObjectId;
}

@Schema({ _id: false })
class OrderStatusEvent {
  @Prop({ required: true, enum: OrderStatus })
  status!: OrderStatus;

  @Prop({ required: true, default: Date.now })
  timestamp!: Date;

  @Prop()
  note?: string;

  @Prop()
  updatedBy?: string;
}

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  customerId!: Types.ObjectId;

  /** Free-text note from the customer for the rider/shop — gate code, "leave with guard",
   * detergent preference, etc. */
  @Prop()
  customerNotes?: string;

  @Prop({ type: Types.ObjectId })
  partnerId?: Types.ObjectId;

  /** Set when this order was auto-created by a customer's recurring pickup subscription
   * rather than placed manually — lets partner-web flag it as a recurring order. */
  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  subscriptionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, index: true })
  branchId?: Types.ObjectId;

  @Prop()
  branchCode?: string;

  @Prop()
  branchName?: string;

  @Prop({ enum: ['pending_dispatch', 'dispatched'] })
  dispatchStatus?: 'pending_dispatch' | 'dispatched';

  @Prop()
  dispatchedAt?: Date;

  @Prop({ type: Types.ObjectId })
  dispatchedBy?: Types.ObjectId;

  @Prop()
  partnerAcceptedAt?: Date;

  @Prop({ type: Types.ObjectId })
  partnerAcceptedBy?: Types.ObjectId;

  @Prop()
  pickupRequestedAt?: Date;

  @Prop()
  deliveryRequestedAt?: Date;

  @Prop()
  slaPickupDueAt?: Date;

  @Prop()
  estimatedTurnaroundHours?: number;

  @Prop({ type: Types.ObjectId })
  suggestedPickupRiderId?: Types.ObjectId;

  @Prop()
  suggestedPickupRiderAt?: Date;

  @Prop({ type: Types.ObjectId })
  pickupRiderAssignedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  suggestedDeliveryRiderId?: Types.ObjectId;

  @Prop()
  suggestedDeliveryRiderAt?: Date;

  @Prop({ type: Types.ObjectId })
  deliveryRiderAssignedBy?: Types.ObjectId;

  @Prop()
  awaitingDeliveryDispatchAt?: Date;

  @Prop({ default: false })
  operationsConflict?: boolean;

  @Prop()
  operationsConflictNote?: string;

  @Prop({ type: Types.ObjectId, index: true })
  pickupRiderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, index: true })
  deliveryRiderId?: Types.ObjectId;

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.PENDING, index: true })
  status!: OrderStatus;

  @Prop({ required: true, enum: BookingType })
  bookingType!: BookingType;

  @Prop({ type: [OrderItem], required: true })
  items!: OrderItem[];

  @Prop({ required: true })
  pickupAddressId!: string;

  @Prop({ required: true })
  deliveryAddressId!: string;

  @Prop({ required: true })
  scheduledPickupAt!: Date;

  @Prop()
  scheduledDeliveryAt?: Date;

  /** Nominal weight from the chosen bag's capacity (FLAT_BAG), or customer-entered estimate (PER_KG/PER_LOAD)
   * — for dispatch capacity scoring/display, and as the pre-confirmation estimate for non-flat modes. */
  @Prop()
  estimatedWeightKg?: number;

  /** PER_LOAD orders only — customer-entered/derived estimated load count. */
  @Prop()
  estimatedLoadCount?: number;

  /** PER_PIECE orders only — customer-entered estimated piece count. */
  @Prop()
  estimatedPieceCount?: number;

  /** Garment-priced orders only (see GARMENT_PRICED_BOOKING_TYPES) — the garments + quantity
   * the service subtotal was computed from. */
  @Prop({ type: [OrderGarmentSelection], default: undefined })
  garmentSelections?: OrderGarmentSelection[];

  /** Flat bag size the customer selected and paid for (see @lunara/utils BAG_SIZES). Unset for PER_KG/PER_LOAD/PER_PIECE orders. */
  @Prop()
  bagSizeId?: string;

  @Prop()
  bagSizeLabel?: string;

  /** Branch's pricing mode at booking time — snapshotted so later branch-mode changes never
   * retroactively affect an in-flight order. */
  @Prop({ enum: BranchPricingMode, default: BranchPricingMode.FLAT_BAG })
  pricingMode!: BranchPricingMode;

  /** Branch's own rates at booking time (PER_KG/PER_LOAD only) — the source of truth for pickup-time
   * finalization, since the branch's live rates may have changed since booking. */
  @Prop({ type: OrderPricingSnapshot })
  pricingSnapshot?: OrderPricingSnapshot;

  /** Set once the partner confirms actual weight/load/piece count at pickup (non-FLAT_BAG orders
   * only). `subtotal`/`total`/`baseSubtotal` below are overwritten with these values at that point
   * so settlement/revenue/payout calculations (which read those fields directly) automatically
   * reflect the finalized amount — these `final*` fields are kept as a record of what was applied. */
  @Prop()
  finalServiceSubtotal?: number;

  @Prop()
  finalTotal?: number;

  @Prop()
  finalPartnerPayout?: number;

  /** Snapshot of subtotal/total/baseSubtotal as they were at booking time, taken right before
   * they're overwritten with finalized values — lets the customer/partner UI keep showing "was
   * estimated at ₱X" after finalization. Unset for FLAT_BAG orders (never overwritten). */
  @Prop()
  estimatedSubtotal?: number;

  @Prop()
  estimatedTotal?: number;

  @Prop()
  estimatedBaseSubtotal?: number;

  @Prop({ type: [OrderAddon], default: [] })
  addons!: OrderAddon[];

  @Prop({ type: OrderPickup, default: {} })
  pickup!: OrderPickup;

  @Prop({ type: OrderShopReceiving, default: {} })
  shopReceiving!: OrderShopReceiving;

  @Prop({ type: OrderLaundryProcessing, default: {} })
  laundryProcessing!: OrderLaundryProcessing;

  @Prop({ type: OrderDelivery, default: {} })
  delivery!: OrderDelivery;

  @Prop({ required: true })
  subtotal!: number;

  @Prop({ default: 0 })
  discount!: number;

  @Prop({ uppercase: true })
  couponCode?: string;

  /** Who absorbs `discount` — 'partner' means it comes out of the assigned branch's own payout at
   * settlement (see PartnerOperationsService.computeOrderFee); 'platform' (or unset, e.g. orders
   * with no coupon) means Lunara's commission absorbs it and the partner's payout is unaffected. */
  @Prop({ enum: ['platform', 'partner'] })
  discountFundedBy?: 'platform' | 'partner';

  @Prop({ required: true })
  deliveryFee!: number;

  @Prop({ required: true })
  total!: number;

  /** Partner's payout-side subtotal before Lunara's cut (service portion split by branch.commissionRate,
   * plus shop-markup add-ons), for 'commission'/'shop_markup' orders only. */
  @Prop()
  baseSubtotal?: number;

  /** How Lunara's cut was computed for this order — missing/legacy orders use branch.commissionRate at settlement.
   * 'commission': flat bag price split by branch.commissionRate (current model).
   * 'shop_markup': legacy per-kg orders priced before flat bag pricing. */
  @Prop({ enum: ['legacy_commission', 'shop_markup', 'commission'] })
  pricingModel?: 'legacy_commission' | 'shop_markup' | 'commission';

  @Prop({ type: [OrderStatusEvent], default: [] })
  statusHistory!: OrderStatusEvent[];

  @Prop({ enum: ['delivery', 'customer_pickup'], default: 'delivery' })
  fulfillmentType!: 'delivery' | 'customer_pickup';

  @Prop()
  customerPickupAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'PartnerSettlement' })
  settlementId?: Types.ObjectId;

  /** Pickup-to-shop distance computed at checkout. */
  @Prop()
  deliveryDistanceKm?: number;

  /** True when deliveryDistanceKm exceeded the assigned branch's own serviceRadiusKm (but was still
   * within the platform-wide maxDeliveryRadiusKm) — dispatch is held until an admin approves it. */
  @Prop({ default: false })
  requiresDeliveryApproval!: boolean;

  @Prop()
  deliveryApprovedAt?: Date;

  @Prop({ type: Types.ObjectId })
  deliveryApprovedBy?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Sparse partial indexes: most orders never have a shelf slot / tag code, so
// these only index the (small) subset of documents that do, keeping the
// index compact. Backs ProcessingService.findOnShelf (shelf-lookup search).
OrderSchema.index(
  { 'laundryProcessing.shelfSlot': 1 },
  { partialFilterExpression: { 'laundryProcessing.shelfSlot': { $exists: true } } },
);
OrderSchema.index(
  { 'laundryProcessing.tagId': 1 },
  { partialFilterExpression: { 'laundryProcessing.tagId': { $exists: true } } },
);
// Backs date-range queries and sorting used by admin reports/dashboards (e.g. AdminService.getReports).
OrderSchema.index({ createdAt: -1 });
