import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ timestamps: true, collection: 'customers' })
export class Customer {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: 0 })
  loyaltyPoints!: number;

  @Prop({ unique: true, sparse: true, index: true })
  referralCode?: string;

  @Prop({ type: Types.ObjectId })
  referredBy?: Types.ObjectId;

  /** Customer self-identifies as booking for a business — unlocks the consolidated
   * monthly order/spend summary. Not a verified/billing entity, just a UI flag for now. */
  @Prop({ default: false })
  isBusiness!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
