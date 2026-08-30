import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PromotionAudience, PromotionKind } from '@lunara/types';
import { HydratedDocument, Types } from 'mongoose';

export type PromotionDocument = HydratedDocument<Promotion>;

@Schema({ timestamps: true, collection: 'promotions' })
export class Promotion {
  @Prop({ required: true, unique: true, uppercase: true })
  code!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: ['percent', 'fixed'] })
  discountType!: 'percent' | 'fixed';

  @Prop({ required: true })
  discountValue!: number;

  @Prop({ default: 0 })
  minOrderAmount!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ enum: PromotionAudience, default: PromotionAudience.ALL })
  audience!: PromotionAudience;

  @Prop({ enum: PromotionKind, default: PromotionKind.STANDARD })
  kind!: PromotionKind;

  @Prop()
  maxUsesPerCustomer?: number;

  @Prop()
  newCustomerWithinDays?: number;

  @Prop()
  startsAt?: Date;

  @Prop()
  endsAt?: Date;

  /** Set only for partner-created promotions — restricts eligibility to orders assigned to one of
   * this partner's branches. Absent for platform (admin-created) promotions, which apply everywhere. */
  @Prop({ type: Types.ObjectId, index: true })
  partnerUserId?: Types.ObjectId;

  /** Platform (admin-created) promotions only: partners who've opted into running this promo at
   * their own shops. Admin promos are suggestions — a platform promo code is only valid at
   * checkout for a partner's branch once that partner has opted in (see
   * PromotionsService.applyCouponToQuote). Meaningless/unused on partner-created promotions,
   * which are always scoped to their own creator via partnerUserId instead. */
  @Prop({ type: [Types.ObjectId], default: [] })
  optedInPartnerIds!: Types.ObjectId[];

  /** Who absorbs the discount amount. Platform promotions always absorb it as a Lunara cost;
   * partner promotions deduct it from the partner's own payout at settlement. */
  @Prop({ enum: ['platform', 'partner'], default: 'platform' })
  fundedBy!: 'platform' | 'partner';

  /** Partner-created promotions start 'pending' and aren't usable at checkout until an admin
   * approves them (see PromotionsService.applyCouponToQuote). Platform promotions skip review
   * entirely — 'approved' from creation. */
  @Prop({ enum: ['approved', 'pending', 'rejected'], default: 'approved' })
  approvalStatus!: 'approved' | 'pending' | 'rejected';

  @Prop()
  adminNote?: string;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: Types.ObjectId })
  reviewedBy?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
