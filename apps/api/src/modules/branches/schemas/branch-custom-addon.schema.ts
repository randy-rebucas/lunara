import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BranchCustomAddonDocument = HydratedDocument<BranchCustomAddon>;

@Schema({ timestamps: true, collection: 'branch_custom_addons' })
export class BranchCustomAddon {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerUserId!: Types.ObjectId;

  /** Branch-scoped slug, unique per branch (not globally unique like LaundryAddon.slug). */
  @Prop({ required: true })
  slug!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ type: String, default: null })
  imageUrl?: string | null;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  /** Booking types this add-on may be attached to (empty/unset = applies to any service). */
  @Prop({ type: [String], default: [] })
  applicableServiceTypes?: string[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const BranchCustomAddonSchema = SchemaFactory.createForClass(BranchCustomAddon);
BranchCustomAddonSchema.index({ branchId: 1, slug: 1 }, { unique: true });
BranchCustomAddonSchema.index({ branchId: 1, isActive: 1 });
