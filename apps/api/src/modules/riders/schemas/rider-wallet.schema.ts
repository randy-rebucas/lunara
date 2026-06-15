import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RiderWalletTransactionDocument = HydratedDocument<RiderWalletTransaction>;

@Schema({ timestamps: true, collection: 'rider_wallet_transactions' })
export class RiderWalletTransaction {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  riderUserId!: Types.ObjectId;

  @Prop({ required: true, enum: ['credit', 'debit', 'hold', 'release', 'netting'] })
  type!: 'credit' | 'debit' | 'hold' | 'release' | 'netting';

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

export type RiderCashRemittanceDocument = HydratedDocument<RiderCashRemittance>;

/**
 * Tracks each cash collection event where the rider's earned fee is netted off
 * against the cash amount before remitting to Lunara admin.
 */
@Schema({ timestamps: true, collection: 'rider_cash_remittances' })
export class RiderCashRemittance {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  riderUserId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  paymentId!: Types.ObjectId;

  /** 'pickup' or 'delivery' — the stage at which cash was collected */
  @Prop({ required: true, enum: ['pickup', 'delivery'] })
  stage!: 'pickup' | 'delivery';

  /** Full cash amount collected from the customer */
  @Prop({ required: true })
  cashAmount!: number;

  /** Rider's earned fee for this task (offsetted amount) */
  @Prop({ required: true })
  earningOffset!: number;

  /** Net amount the rider must remit to admin (cashAmount - earningOffset) */
  @Prop({ required: true })
  netRemittance!: number;

  /** pending → rider submits → admin confirms (remitted) */
  @Prop({ required: true, enum: ['pending', 'submitted', 'remitted'], default: 'pending', index: true })
  status!: 'pending' | 'submitted' | 'remitted';

  @Prop()
  submittedAt?: Date;

  @Prop()
  remittedAt?: Date;

  @Prop({ type: Types.ObjectId })
  verifiedBy?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RiderCashRemittanceSchema = SchemaFactory.createForClass(RiderCashRemittance);
RiderCashRemittanceSchema.index({ riderUserId: 1, orderId: 1, stage: 1 }, { unique: true });
