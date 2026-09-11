import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '@lunara/types';

export type AttendanceRecordDocument = HydratedDocument<AttendanceRecord>;

/**
 * One work session for a partner-scoped employee (laundry attendant = UserRole.STAFF,
 * rider = UserRole.RIDER). Deliberately separate from Rider.shiftStatus/isOnline: attendance
 * answers "is this person working today", availability answers "can they receive work right
 * now" — see the lunara-feature-implementation skill's guidance not to couple the two without
 * an explicit product decision.
 */
@Schema({ timestamps: true, collection: 'attendance_records' })
export class AttendanceRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  /** Owning partner — for STAFF, the partner that owns their branch; for RIDER, Rider.partnerId.
   * Denormalized at clock-in time so partner-scoped queries never need a join. */
  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerId!: Types.ObjectId;

  @Prop({ required: true, enum: [UserRole.STAFF, UserRole.RIDER] })
  role!: UserRole.STAFF | UserRole.RIDER;

  /** STAFF only — the branch they were clocked in for. Undefined for riders. */
  @Prop({ type: Types.ObjectId })
  branchId?: Types.ObjectId;

  /** Manila-local calendar date (YYYY-MM-DD) the session's clock-in falls on — the workday key
   * used for "who worked which day" queries and to bound the one-active-session invariant. */
  @Prop({ required: true, index: true })
  workDate!: string;

  @Prop({ required: true })
  clockInAt!: Date;

  @Prop()
  clockOutAt?: Date;

  @Prop({ required: true, enum: ['active', 'completed'], default: 'active', index: true })
  status!: 'active' | 'completed';

  @Prop({
    type: { lat: Number, lng: Number },
    _id: false,
  })
  clockInLocation?: { lat: number; lng: number };

  @Prop({
    type: { lat: Number, lng: Number },
    _id: false,
  })
  clockOutLocation?: { lat: number; lng: number };

  /** How the session was created — 'mobile' from the employee's own device, 'partner_correction'
   * when a partner owner/admin manually adjusts a record (always audited via correction fields). */
  @Prop({ required: true, enum: ['mobile', 'partner_correction'], default: 'mobile' })
  source!: 'mobile' | 'partner_correction';

  @Prop()
  notes?: string;

  /** Set only when a partner owner/admin edits this record after creation — audit trail per
   * the skill's requirement that attendance corrections be tracked, not silent. */
  @Prop({ type: Types.ObjectId })
  correctedBy?: Types.ObjectId;

  @Prop()
  correctedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AttendanceRecordSchema = SchemaFactory.createForClass(AttendanceRecord);

// Enforces "a user cannot have two active attendance sessions" at the database level.
AttendanceRecordSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
AttendanceRecordSchema.index({ partnerId: 1, workDate: 1 });
