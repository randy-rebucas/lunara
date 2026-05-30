import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  partnerId?: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ maxlength: 2000 })
  comment?: string;

  @Prop({ required: true, default: Date.now })
  publishedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ orderId: 1, customerId: 1 }, { unique: true });
