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

  /** Mirrors orderId only while this refund is in a non-terminal status (unset once
   * rejected/processed/closed) — backs a unique partial index so two concurrent createRequest
   * calls for the same order can't both create an "open" refund; see refunds.service.ts. */
  @Prop({ type: Types.ObjectId })
  openOrderId?: Types.ObjectId;

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
// Enforces "at most one open refund per order" atomically at the DB level, closing the race where
// two concurrent createRequest calls both pass the pre-insert findOne check.
RefundRequestSchema.index(
  { openOrderId: 1 },
  { unique: true, partialFilterExpression: { openOrderId: { $exists: true } } },
);
