import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PromotionUsageCounterDocument = HydratedDocument<PromotionUsageCounter>;

/**
 * Atomic per-customer usage counter for a shared promotion, separate from PromotionRedemption
 * (which is the audit trail). A single-document `findOneAndUpdate` with a `count: { $lt: max }`
 * filter is how `maxUsesPerCustomer` is actually enforced under concurrency — counting existing
 * PromotionRedemption rows and then inserting a new one (the old approach) is a check-then-act
 * race: two concurrent orders can both pass the count check before either insert lands.
 */
@Schema({ timestamps: true, collection: 'promotion_usage_counters' })
export class PromotionUsageCounter {
  @Prop({ type: Types.ObjectId, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  promotionId!: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  count!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PromotionUsageCounterSchema = SchemaFactory.createForClass(PromotionUsageCounter);
PromotionUsageCounterSchema.index({ userId: 1, promotionId: 1 }, { unique: true });
