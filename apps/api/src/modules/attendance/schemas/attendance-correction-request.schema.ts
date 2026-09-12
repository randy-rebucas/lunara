import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '@lunara/types';

export type AttendanceCorrectionRequestDocument = HydratedDocument<AttendanceCorrectionRequest>;

/**
 * A rider/staff-initiated request to amend one of their own AttendanceRecord sessions (e.g. they
 * forgot to clock out). Distinct from AttendanceRecord.source = 'partner_correction', which is a
 * partner owner/admin editing a record directly — this is the employee-initiated counterpart:
 * nothing on the record changes until a partner owner/admin reviews and approves it.
 */
@Schema({ timestamps: true, collection: 'attendance_correction_requests' })
export class AttendanceCorrectionRequest {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  recordId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  /** Denormalized at request time so partner-scoped queries never need a join, same as
   * AttendanceRecord.partnerId. */
  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerId!: Types.ObjectId;

  @Prop({ required: true, enum: [UserRole.STAFF, UserRole.RIDER] })
  role!: UserRole.STAFF | UserRole.RIDER;

  @Prop({ required: true })
  workDate!: string;

  /** The record's clock-in/out at the time the request was filed — kept so the partner review UI
   * can show a before/after diff without a second lookup. */
  @Prop({ required: true })
  originalClockInAt!: Date;

  @Prop()
  originalClockOutAt?: Date;

  /** Undefined = "no change requested to this field". */
  @Prop()
  requestedClockInAt?: Date;

  @Prop()
  requestedClockOutAt?: Date;

  @Prop({ required: true, maxlength: 500 })
  reason!: string;

  @Prop({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true })
  status!: 'pending' | 'approved' | 'rejected';

  @Prop({ type: Types.ObjectId })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop({ maxlength: 500 })
  reviewNote?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AttendanceCorrectionRequestSchema = SchemaFactory.createForClass(AttendanceCorrectionRequest);

AttendanceCorrectionRequestSchema.index({ partnerId: 1, status: 1 });
