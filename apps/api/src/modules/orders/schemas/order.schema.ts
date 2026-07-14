import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BookingType, OrderStatus } from '@lunara/types';

export type OrderDocument = HydratedDocument<Order>;

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

  @Prop({ type: Types.ObjectId })
  partnerId?: Types.ObjectId;

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

  @Prop({ type: Types.ObjectId })
  pickupRiderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  deliveryRiderId?: Types.ObjectId;

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.PENDING })
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

  /** Nominal weight from the chosen bag's capacity — for dispatch capacity scoring/display, not billing. */
  @Prop()
  estimatedWeightKg?: number;

  /** Flat bag size the customer selected and paid for (see @lunara/utils BAG_SIZES). */
  @Prop()
  bagSizeId?: string;

  @Prop()
  bagSizeLabel?: string;

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
