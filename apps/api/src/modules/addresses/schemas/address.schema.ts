import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AddressDocument = HydratedDocument<Address>;

@Schema({ timestamps: true, collection: 'addresses' })
export class Address {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  label!: string;

  @Prop({ default: 'home', enum: ['home', 'work', 'apartment', 'other'] })
  addressType!: string;

  @Prop({ required: true })
  line1!: string;

  @Prop()
  line2?: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true })
  province!: string;

  @Prop({ required: true })
  postalCode!: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({ default: false })
  isDefault!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
