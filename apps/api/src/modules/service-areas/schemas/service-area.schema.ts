import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BookingType } from '@lunara/types';
import { HydratedDocument } from 'mongoose';

export type ServiceAreaDocument = HydratedDocument<ServiceArea>;

@Schema({ timestamps: true, collection: 'service_areas' })
export class ServiceArea {
  @Prop({ required: true })
  label!: string;

  @Prop({ type: [String], default: [] })
  cities!: string[];

  @Prop({ type: [String], default: [] })
  provinces!: string[];

  @Prop({ type: [String], default: [] })
  postalPrefixes!: string[];

  /** Booking types available in this area — empty means every active type is allowed. */
  @Prop({ type: [String], enum: BookingType, default: [] })
  services!: BookingType[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ServiceAreaSchema = SchemaFactory.createForClass(ServiceArea);
