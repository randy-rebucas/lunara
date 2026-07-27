import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BookingType } from '@lunara/types';
import { BranchPricingMode } from '@lunara/utils';
import { HydratedDocument, Types } from 'mongoose';

export type BranchCustomServiceDocument = HydratedDocument<BranchCustomService>;

@Schema({ timestamps: true, collection: 'branch_custom_services' })
export class BranchCustomService {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerUserId!: Types.ObjectId;

  /** Anchors this custom service to an existing BookingType for order/SLA processing. */
  @Prop({ required: true, enum: BookingType })
  baseBookingType!: BookingType;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  description!: string;

  /** Legacy default rate — required historically, now just the PER_KG rate when pricingUnit is
   * PER_KG (or unset, for services created before per-service pricing units existed). */
  @Prop({ min: 0 })
  pricePerKg?: number;

  @Prop({ min: 0 })
  basePricePerLoad?: number;

  @Prop({ min: 0 })
  basePricePerPiece?: number;

  @Prop({ min: 0 })
  basePricePerPair?: number;

  @Prop({ min: 0 })
  basePricePerItem?: number;

  @Prop({ min: 0 })
  fixedPrice?: number;

  /** Falls back to PER_KG (today's behavior) when unset. */
  @Prop({ enum: BranchPricingMode })
  pricingUnit?: BranchPricingMode;

  @Prop({ default: 3 })
  minWeightKg!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  sortOrder!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const BranchCustomServiceSchema = SchemaFactory.createForClass(BranchCustomService);
BranchCustomServiceSchema.index({ branchId: 1, isActive: 1 });
