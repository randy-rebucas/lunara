import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefundRequestDocument = HydratedDocument<RefundRequest>;

export enum RefundStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
  CLOSED = 'closed',
}

export enum RefundStage {
  SUBMITTED = 'submitted',
  ADMIN_REVIEW = 'admin_review',
  ORDER_VERIFIED = 'order_verified',
  DECISION = 'decision',
  PROCESSED = 'processed',
  NOTIFIED = 'notified',
}

@Schema({ _id: false })
class RefundTimelineEntry {
  @Prop({ required: true })
  stage!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ default: Date.now })
  at!: Date;

  @Prop()
  note?: string;
}

@Schema({ timestamps: true, collection: 'refund_requests' })
export class RefundRequest {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  paymentId?: Types.ObjectId;

  @Prop({ required: true })
  reason!: string;

  @Prop({ required: true, enum: RefundStatus, default: RefundStatus.PENDING, index: true })
  status!: RefundStatus;

  @Prop({ required: true, enum: RefundStage, default: RefundStage.SUBMITTED })
  stage!: RefundStage;

  @Prop({ required: true })
  requestedAmount!: number;

  @Prop()
  approvedAmount?: number;

  @Prop()
  adminNote?: string;

  @Prop()
  rejectionReason?: string;

  @Prop()
  orderVerifiedAt?: Date;

  @Prop({ type: Types.ObjectId })
  reviewedBy?: Types.ObjectId;

  @Prop()
  processedAt?: Date;

  @Prop()
  customerNotifiedAt?: Date;

  @Prop({ type: [RefundTimelineEntry], default: [] })
  timeline!: RefundTimelineEntry[];

  createdAt!: Date;
  updatedAt!: Date;
}

export const RefundRequestSchema = SchemaFactory.createForClass(RefundRequest);
// Backs date-range queries used by admin reports.
RefundRequestSchema.index({ createdAt: -1 });
