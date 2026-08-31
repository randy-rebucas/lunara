import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<BillingSubscription>;

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'grace_period',
  'suspended',
  'cancelled',
  'expired',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * A partner's SaaS subscription. Keyed by the partner owner's User._id (same id used
 * throughout PartnerOperationsService/PartnerController as "partnerId") rather than
 * Partner._id, so it drops in without an extra Partner lookup at any existing call site.
 * One doc per partner (unique index) — Phase 1 doesn't need subscription history.
 *
 * Named BillingSubscription (not Subscription) because apps/api/src/modules/subscriptions
 * already has an unrelated `Subscription` class (customer recurring pickup orders, collection
 * 'subscriptions') — NestJS/Mongoose model registration is keyed by class .name, so two
 * classes literally named `Subscription` collide and one silently shadows the other's model
 * (no error, no warning — reads/writes go to the wrong collection).
 */
@Schema({ timestamps: true, collection: 'partner_subscriptions' })
export class BillingSubscription {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  partnerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  planId!: Types.ObjectId;

  @Prop({ required: true, enum: SUBSCRIPTION_STATUSES, default: 'trialing', index: true })
  status!: SubscriptionStatus;

  @Prop({ required: true })
  currentPeriodStart!: Date;

  @Prop({ required: true })
  currentPeriodEnd!: Date;

  @Prop()
  trialEndsAt?: Date;

  @Prop({ default: false })
  cancelAtPeriodEnd!: boolean;

  @Prop()
  cancelledAt?: Date;

  /** Monthly price locked in when this plan was assigned, so a later admin edit to
   * Plan.monthlyPrice doesn't retroactively reprice a cycle already in progress. */
  @Prop({ required: true, default: 0 })
  priceSnapshot!: number;

  /** Unused in Phase 1 — reserved so a later phase can add real PayMongo recurring
   * charging without another schema migration. */
  @Prop({ default: 'manual', enum: ['manual', 'paymongo'] })
  provider!: 'manual' | 'paymongo';

  @Prop()
  providerCustomerId?: string;

  @Prop()
  providerSubscriptionId?: string;

  /** True once a card has been attached via attachPaymentMethod — gates the auto-charge
   * attempt in PartnerOperationsService.createInvoice; false means the manual invoice flow
   * (bank transfer/GCash, admin marks paid) is the only path, same as Phase 1. */
  @Prop({ default: false })
  paymentMethodOnFile!: boolean;

  /** PayMongo Payment Method id for the saved card — only set when paymentMethodOnFile/provider
   * are 'paymongo'. */
  @Prop()
  paymongoPaymentMethodId?: string;

  @Prop()
  cardBrand?: string;

  @Prop()
  cardLast4?: string;

  @Prop()
  adminNote?: string;

  /** Dunning lifecycle timestamps — set on entering each stage, cleared on reactivation.
   * See SubscriptionService.transitionStatus and AutomationSchedulerService.sweepDunning. */
  @Prop()
  pastDueAt?: Date;

  @Prop()
  gracePeriodStartedAt?: Date;

  @Prop()
  suspendedAt?: Date;

  /** Last time an auto-charge retry was attempted while past_due/grace_period — caps retries
   * to once per day per partner regardless of how many overdue invoices exist. */
  @Prop()
  lastDunningAttemptAt?: Date;

  /** Active billing promo, if any — snapshot of the BillingPromotion's discount at redemption
   * time so a later edit to the promo doesn't retroactively change what this partner gets.
   * See PartnerOperationsService.applyPromotionDiscount. */
  @Prop({ type: Types.ObjectId })
  activePromotionId?: Types.ObjectId;

  @Prop()
  promotionCode?: string;

  @Prop({ enum: ['percentage', 'fixed', 'free_months'] })
  promotionDiscountType?: 'percentage' | 'fixed' | 'free_months';

  @Prop()
  promotionDiscountValue?: number;

  /** Only set/used when promotionDiscountType === 'free_months' — decremented each time a
   * cycle is billed under the promo (see SubscriptionService.advancePeriod), cleared when it
   * hits 0 so the fee reverts to full price automatically with no separate expiry job. */
  @Prop()
  promotionFreeMonthsRemaining?: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(BillingSubscription);
