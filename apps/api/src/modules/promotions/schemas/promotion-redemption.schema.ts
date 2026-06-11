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
