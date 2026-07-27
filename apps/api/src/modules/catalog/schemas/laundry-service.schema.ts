import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BookingType, ServiceCategory } from '@lunara/types';
import { HydratedDocument } from 'mongoose';

export type LaundryServiceDocument = HydratedDocument<LaundryService>;

@Schema({ timestamps: true, collection: 'laundry_services' })
export class LaundryService {
  @Prop({ required: true, enum: BookingType, unique: true })
  type!: BookingType;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ enum: ServiceCategory })
  category?: ServiceCategory;

  @Prop({ required: true })
  pricePerKg!: number;

  @Prop({ required: true, default: 3 })
  minWeightKg!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LaundryServiceSchema = SchemaFactory.createForClass(LaundryService);
