import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PartnerRewardsProgramDocument = HydratedDocument<PartnerRewardsProgram>;

@Schema({ _id: false })
export class RewardsCatalogItem {
  /** Stable id within this partner's catalog (not globally unique) — generated once on creation,
   * used to target one item for edit/delete/redeem without depending on array position. */
  @Prop({ required: true })
  itemId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true, min: 1 })
  points!: number;

  @Prop({ required: true, enum: ['percent', 'fixed'] })
  discountType!: 'percent' | 'fixed';

  @Prop({ required: true })
  discountValue!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const RewardsCatalogItemSchema = SchemaFactory.createForClass(RewardsCatalogItem);

/**
 * A partner's own loyalty program for their shop(s) — replaces the old hardcoded platform-wide
 * catalog. Entirely partner-configured and partner-funded (redeemed vouchers deduct from the
 * partner's own payout at settlement, same as partner-created promotions); no admin review or
 * involvement anywhere in this workflow. One document per partner (partnerUserId unique).
 */
@Schema({ timestamps: true, collection: 'partner_rewards_programs' })
export class PartnerRewardsProgram {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  partnerUserId!: Types.ObjectId;

  /** When false, orders at this partner's shops stop earning points and the catalog is hidden
   * from customers, but existing balances/vouchers already issued remain valid. */
  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ required: true, default: 50, min: 1 })
  pointsPerCompletedOrder!: number;

  @Prop({ type: [RewardsCatalogItemSchema], default: [] })
  catalog!: RewardsCatalogItem[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerRewardsProgramSchema = SchemaFactory.createForClass(PartnerRewardsProgram);
