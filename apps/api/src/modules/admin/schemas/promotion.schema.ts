import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PromotionAudience, PromotionKind } from '@lunara/types';
import { HydratedDocument } from 'mongoose';

export type PromotionDocument = HydratedDocument<Promotion>;

@Schema({ timestamps: true, collection: 'promotions' })
export class Promotion {
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

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ enum: PromotionAudience, default: PromotionAudience.ALL })
  audience!: PromotionAudience;

  @Prop({ enum: PromotionKind, default: PromotionKind.STANDARD })
  kind!: PromotionKind;

  @Prop()
  maxUsesPerCustomer?: number;

  @Prop()
  newCustomerWithinDays?: number;

  @Prop()
  startsAt?: Date;

  @Prop()
  endsAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
