import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RiderWalletTransactionDocument = HydratedDocument<RiderWalletTransaction>;

@Schema({ timestamps: true, collection: 'rider_wallet_transactions' })
export class RiderWalletTransaction {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  riderUserId!: Types.ObjectId;

  @Prop({ required: true, enum: ['credit', 'debit', 'hold', 'release'] })
  type!: 'credit' | 'debit' | 'hold' | 'release';

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, index: true })
  reference!: string;

  @Prop({ required: true })
  description!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RiderWalletTransactionSchema = SchemaFactory.createForClass(RiderWalletTransaction);
RiderWalletTransactionSchema.index({ riderUserId: 1, reference: 1 }, { unique: true });

export type RiderWithdrawalDocument = HydratedDocument<RiderWithdrawal>;

@Schema({ timestamps: true, collection: 'rider_withdrawals' })
export class RiderWithdrawal {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  riderUserId!: Types.ObjectId;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, enum: ['gcash', 'maya', 'bank'] })
  method!: 'gcash' | 'maya' | 'bank';

  @Prop()
  gcashNumber?: string;

  @Prop()
  mayaNumber?: string;

  @Prop()
  bankName?: string;

  @Prop()
  bankAccountName?: string;

  @Prop()
  bankAccountNumber?: string;

  @Prop({
    required: true,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending',
    index: true,
  })
  status!: 'pending' | 'approved' | 'rejected' | 'paid';

  @Prop()
  adminNote?: string;

  @Prop({ type: Types.ObjectId })
  processedBy?: Types.ObjectId;

  @Prop()
  processedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RiderWithdrawalSchema = SchemaFactory.createForClass(RiderWithdrawal);
