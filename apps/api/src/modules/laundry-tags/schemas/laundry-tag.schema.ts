import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LaundryTagDocument = HydratedDocument<LaundryTag>;

export enum LaundryTagStatus {
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  RETIRED = 'retired',
}

@Schema({ _id: false })
class LaundryTagAssignmentEvent {
  @Prop({ type: Types.ObjectId, required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  assignedAt!: Date;

  @Prop()
  releasedAt?: Date;

  @Prop({ type: Types.ObjectId })
  assignedBy?: Types.ObjectId;

  @Prop({ enum: ['delivered', 'manual', 'admin_override'] })
  releaseReason?: string;
}

@Schema({ timestamps: true, collection: 'laundry_tags' })
export class LaundryTag {
  @Prop({ required: true, unique: true, uppercase: true })
  code!: string;

  @Prop({ required: true, enum: LaundryTagStatus, default: LaundryTagStatus.AVAILABLE, index: true })
  status!: LaundryTagStatus;

  @Prop({ type: Types.ObjectId, index: true })
  currentOrderId?: Types.ObjectId;

  @Prop()
  currentAssignedAt?: Date;

  @Prop({ type: Types.ObjectId })
  branchId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  generatedBy!: Types.ObjectId;

  @Prop({ required: true })
  batchId!: string;

  @Prop({ type: [LaundryTagAssignmentEvent], default: [] })
  assignmentHistory!: LaundryTagAssignmentEvent[];

  @Prop()
  retiredAt?: Date;

  @Prop({ type: Types.ObjectId })
  retiredBy?: Types.ObjectId;

  @Prop()
  retiredReason?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const LaundryTagSchema = SchemaFactory.createForClass(LaundryTag);
LaundryTagSchema.index({ status: 1, branchId: 1 });
LaundryTagSchema.index({ batchId: 1 });
