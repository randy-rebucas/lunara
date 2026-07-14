import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PromotionRedemptionDocument = HydratedDocument<PromotionRedemption>;

@Schema({ timestamps: { createdAt: 'redeemedAt', updatedAt: false }, collection: 'promotion_redemptions' })
export class PromotionRedemption {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  promotionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  orderId!: Types.ObjectId;

  redeemedAt!: Date;
}

export const PromotionRedemptionSchema = SchemaFactory.createForClass(PromotionRedemption);
PromotionRedemptionSchema.index({ userId: 1, promotionId: 1 });
// One redemption row per order+promotion — guards a retried recordRedemption call for the same
// order from ever inserting a second row (the maxUsesPerCustomer cap itself is enforced
// atomically by PromotionUsageCounter, not by counting rows in this collection).
PromotionRedemptionSchema.index({ orderId: 1, promotionId: 1 }, { unique: true });
