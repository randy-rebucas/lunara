import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BillingPromotionDocument = HydratedDocument<BillingPromotion>;

export type BillingPromotionDiscountType = 'percentage' | 'fixed' | 'free_months';

/**
 * A SaaS subscription discount code (e.g. founding-partner pricing) — distinct from
 * apps/api/src/modules/admin/schemas/promotion.schema.ts's `Promotion` class, which is the
 * unrelated customer-order coupon system. Named BillingPromotion (not Promotion) deliberately:
 * that class name is already taken, and reusing it would recreate the exact model-registration
 * collision found with Subscription/BillingSubscription.
 */
@Schema({ timestamps: true, collection: 'billing_promotions' })
export class BillingPromotion {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: ['percentage', 'fixed', 'free_months'] })
  discountType!: BillingPromotionDiscountType;

  /** percentage: 1-100. fixed: peso amount off. free_months: number of billing cycles fully waived. */
  @Prop({ required: true })
  discountValue!: number;

  /** Empty = applies to any plan. */
  @Prop({ type: [Types.ObjectId], default: [] })
  applicablePlanIds!: Types.ObjectId[];

  @Prop()
  maxRedemptions?: number;

  @Prop({ default: 0 })
  redemptionCount!: number;

  @Prop()
  expiresAt?: Date;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  adminNote?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const BillingPromotionSchema = SchemaFactory.createForClass(BillingPromotion);
