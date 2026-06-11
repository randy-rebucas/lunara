import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LaundryAddonDocument = HydratedDocument<LaundryAddon>;

@Schema({ timestamps: true, collection: 'laundry_addons' })
export class LaundryAddon {
  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  price!: number;

  @Prop()
  imageUrl?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LaundryAddonSchema = SchemaFactory.createForClass(LaundryAddon);
