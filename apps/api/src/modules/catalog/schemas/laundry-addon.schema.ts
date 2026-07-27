import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AddonCategory } from '@lunara/types';
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

  @Prop({ enum: AddonCategory })
  category?: AddonCategory;

  /** Flat peso total, or the percentage (e.g. 50 for 50%) when isPercentOfService is true. */
  @Prop({ required: true })
  price!: number;

  /** True for add-ons billed as a % of the order's service subtotal (e.g. Express/Same-Day
   * service) instead of a flat peso amount — not partner-configurable, unlike branch pricingUnit. */
  @Prop({ default: false })
  isPercentOfService!: boolean;

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
