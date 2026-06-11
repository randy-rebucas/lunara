import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CustomerPromoDocument = HydratedDocument<CustomerPromo>;

@Schema({ timestamps: true, collection: 'customer_promos' })
export class CustomerPromo {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true, uppercase: true })
  code!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: ['percent', 'fixed'] })
  discountType!: 'percent' | 'fixed';

  @Prop({ required: true })
  discountValue!: number;

  @Prop({ default: 0 })
  minOrderAmount!: number;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop()
  redeemedAt?: Date;

  @Prop({ type: Types.ObjectId })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  sourcePromotionId?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CustomerPromoSchema = SchemaFactory.createForClass(CustomerPromo);
