import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type WalletDocument = HydratedDocument<Wallet>;

@Schema({ timestamps: true, collection: 'wallets' })
export class Wallet {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ default: 0 })
  balance!: number;

  @Prop({ default: 'PHP' })
  currency!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

@Schema({ timestamps: true, collection: 'transactions' })
export class Transaction {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  walletId!: Types.ObjectId;

  @Prop({ required: true, enum: ['credit', 'debit'] })
  type!: 'credit' | 'debit';

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, unique: true })
  reference!: string;

  @Prop({ required: true })
  description!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type TransactionDocument = HydratedDocument<Transaction>;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);
