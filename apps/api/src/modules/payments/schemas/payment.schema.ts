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

  /** Set when the card network/PayMongo pulls this payment back after the fact. Distinct from a
   * customer-initiated or admin-approved refund — no wallet credit is issued for a chargeback. */
  @Prop()
  chargedBackAt?: Date;

  @Prop()
  chargebackAmount?: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Prevents two concurrent createIntent calls for the same order from both creating a pending
// payment row — the second create() hits this constraint (E11000) instead of silently succeeding
// alongside the first, which is what let two PayMongo sessions / two wallet debits exist for one
// order. Scoped to status:'pending' (paid/failed history isn't blocked) AND orderId existing —
// wallet-topup payments have no orderId, and without that second condition every pending wallet
// top-up across all users would collide on the same {null, 'order', 'pending'}-shaped key.
PaymentSchema.index(
  { orderId: 1, purpose: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending', orderId: { $exists: true } } },
);
