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

  createdAt!: Date;
  updatedAt!: Date;
}

export const PointsTransactionSchema = SchemaFactory.createForClass(PointsTransaction);
