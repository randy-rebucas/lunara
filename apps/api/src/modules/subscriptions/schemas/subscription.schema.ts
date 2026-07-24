import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BookingType } from '@lunara/types';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: true, collection: 'subscriptions' })
export class Subscription {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: BookingType })
  bookingType!: BookingType;

  @Prop()
  branchId?: string;

  @Prop()
  bagSizeId?: string;

  @Prop()
  enteredWeightKg?: number;

  @Prop()
  enteredLoadCount?: number;

  @Prop()
  enteredPieceCount?: number;

  @Prop({ type: [String], default: [] })
  addonIds!: string[];

  @Prop()
  couponCode?: string;

  @Prop({ required: true })
  pickupAddressId!: string;

  @Prop()
  deliveryAddressId?: string;

  /** Days between each auto-created order — 7 (weekly), 14 (biweekly), or 30 (monthly). */
  @Prop({ required: true })
  frequencyDays!: number;

  @Prop({ required: true })
  nextRunAt!: Date;

  @Prop({ default: true })
  active!: boolean;

  @Prop()
  lastRunAt?: Date;

  @Prop({ type: Types.ObjectId })
  lastOrderId?: Types.ObjectId;

  @Prop()
  lastError?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
