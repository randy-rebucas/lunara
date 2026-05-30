import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BranchDocument = HydratedDocument<Branch>;

@Schema({ _id: false })
class BranchMachine {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true, enum: ['washer', 'dryer', 'folder', 'press', 'other'] })
  machineType!: string;

  @Prop({ default: 'active', enum: ['active', 'maintenance', 'offline'] })
  status!: string;

  @Prop({ default: 8 })
  capacityKg!: number;
}

@Schema({ timestamps: true, collection: 'branches' })
export class Branch {
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: ['hq', 'franchise', 'partner_shop'], default: 'partner_shop' })
  branchType!: 'hq' | 'franchise' | 'partner_shop';

  @Prop({ type: Types.ObjectId, index: true })
  parentBranchId?: Types.ObjectId;

  @Prop({ required: true })
  line1!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true })
  province!: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerUserId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  managerUserId?: Types.ObjectId;

  @Prop({ default: 25 })
  maxActiveOrders!: number;

  @Prop({ default: 200 })
  maxWeightCapacityKg!: number;

  @Prop({ default: 30 })
  dailyQuotaOrders!: number;

  @Prop({ default: 250 })
  dailyQuotaWeightKg!: number;

  @Prop({ default: 15 })
  serviceRadiusKm!: number;

  @Prop({ type: [BranchMachine], default: [] })
  machines!: BranchMachine[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  })
  location!: { type: string; coordinates: [number, number] };

  createdAt!: Date;
  updatedAt!: Date;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
BranchSchema.index({ location: '2dsphere' });
BranchSchema.index({ parentBranchId: 1 });
