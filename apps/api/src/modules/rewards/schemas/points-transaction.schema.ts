import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PointsTransactionDocument = HydratedDocument<PointsTransaction>;

@Schema({ timestamps: true, collection: 'points_transactions' })
export class PointsTransaction {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['credit', 'debit'] })
  type!: 'credit' | 'debit';

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, unique: true })
  reference!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, enum: ['order', 'referral', 'redemption'] })
  sourceType!: 'order' | 'referral' | 'redemption';

  /** The shop the earning order was placed at (order-sourced credits only) — lets a partner see
   * how much loyalty activity their own program is generating at their own shop. */
  @Prop({ type: Types.ObjectId, index: true })
  branchId?: Types.ObjectId;

  /** The partner this transaction's points belong to — every 'order' credit and any 'redemption'
   * debit spent from a partner-scoped balance carries this (see RewardsService.creditForCompletedOrder
   * and RewardsService.redeem). Absent for 'referral' credits/debits, which are a platform-wide
   * balance usable as top-up at any partner's catalog rather than tied to one shop. */
  @Prop({ type: Types.ObjectId, index: true })
  partnerUserId?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PointsTransactionSchema = SchemaFactory.createForClass(PointsTransaction);
