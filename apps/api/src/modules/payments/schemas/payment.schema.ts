import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '@lunara/types';

export type PaymentPurpose = 'order' | 'wallet_topup';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: Types.ObjectId, index: true })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['order', 'wallet_topup'], default: 'order' })
  purpose!: PaymentPurpose;

  @Prop({ required: true, enum: PaymentMethod })
  method!: PaymentMethod;

  @Prop({ required: true, enum: PaymentStatus, default: PaymentStatus.PENDING, index: true })
  status!: PaymentStatus;

  @Prop({ required: true })
  amount!: number;

  @Prop()
  externalId?: string;

  @Prop()
  paymongoSessionId?: string;

  /** Browser origin used to start checkout — keeps PayMongo return on the same host as the session. */
  @Prop()
  returnOrigin?: string;

  @Prop()
  checkoutUrl?: string;

  @Prop()
  receiptCode?: string;

  @Prop({ enum: ['pickup', 'delivery'] })
  cashTiming?: 'pickup' | 'delivery';

  @Prop({ type: Types.ObjectId })
  cashCollectedBy?: Types.ObjectId;

  @Prop()
  paidAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
