import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { RiderDocumentStatus, RiderDocumentType } from '../rider-compliance';

export type RiderDocument = HydratedDocument<Rider>;

@Schema({ _id: false })
class RiderEarningRecord {
  @Prop({ required: true, enum: ['pickup', 'delivery', 'bonus', 'adjustment', 'wage'] })
  type!: 'pickup' | 'delivery' | 'bonus' | 'adjustment' | 'wage';

  @Prop({ required: true })
  amount!: number;

  @Prop({ type: Types.ObjectId })
  orderId?: Types.ObjectId;

  @Prop()
  note?: string;

  @Prop({ default: Date.now })
  earnedAt!: Date;
}

@Schema({ _id: false })
class RiderHomeAddress {
  @Prop()
  line1?: string;

  @Prop()
  line2?: string;

  @Prop()
  city?: string;

  @Prop()
  province?: string;

  @Prop()
  postalCode?: string;

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;
}

@Schema({ _id: false })
class RiderKycDocument {
  @Prop({ required: true })
  type!: RiderDocumentType;

  @Prop()
  fileUrl?: string;

  @Prop({ enum: ['pending', 'approved', 'rejected'] })
  status?: RiderDocumentStatus;

  @Prop()
  uploadedAt?: Date;

  @Prop()
  reviewedAt?: Date;

  @Prop()
  reviewedBy?: string;

  @Prop()
  rejectionReason?: string;
}

@Schema({ timestamps: true, collection: 'riders' })
export class Rider {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  /** Owning partner (a User with role PARTNER) — riders created via partner-web are scoped to this
   * partner across all of their branches. Nullable only for pre-migration platform riders. */
  @Prop({ type: Types.ObjectId, index: true })
  partnerId?: Types.ObjectId;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop({ type: RiderHomeAddress })
  homeAddress?: RiderHomeAddress;

  @Prop({ default: 'motorcycle' })
  vehicleType!: string;

  @Prop()
  plateNumber?: string;

  @Prop()
  orCrNumber?: string;

  @Prop({ default: 'independent_contractor', enum: ['employee', 'independent_contractor'] })
  employmentType!: 'employee' | 'independent_contractor';

  @Prop()
  fixedWageAmount?: number;

  @Prop({ enum: ['daily', 'weekly', 'monthly'] })
  wageFrequency?: 'daily' | 'weekly' | 'monthly';

  @Prop({ type: [RiderKycDocument], default: [] })
  documents!: RiderKycDocument[];

  @Prop({ default: false })
  isOnline!: boolean;

  @Prop({ default: 'offline', enum: ['offline', 'online', 'break'] })
  shiftStatus!: 'offline' | 'online' | 'break';

  @Prop({ type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [0, 0] } })
  currentLocation!: { type: string; coordinates: number[] };

  @Prop()
  lastLocationSpeed?: number;

  @Prop()
  lastLocationHeading?: number;

  @Prop()
  lastLocationRecordedAt?: Date;

  @Prop({ default: 0 })
  totalEarnings!: number;

  @Prop({ default: 0 })
  todayEarnings!: number;

  @Prop()
  earningsDayKey?: string;

  @Prop({ type: [RiderEarningRecord], default: [] })
  recentEarnings!: RiderEarningRecord[];

  @Prop({ default: 0 })
  walletBalance!: number;

  @Prop({ default: 0 })
  pendingHold!: number;

  @Prop({ enum: ['gcash', 'maya', 'bank'] })
  payoutMethod?: 'gcash' | 'maya' | 'bank';

  @Prop()
  gcashNumber?: string;

  @Prop()
  mayaNumber?: string;

  @Prop()
  bankName?: string;

  @Prop()
  bankAccountName?: string;

  @Prop()
  bankAccountNumber?: string;

  @Prop({ default: false })
  walletBackfilled!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RiderSchema = SchemaFactory.createForClass(Rider);
RiderSchema.index({ currentLocation: '2dsphere' });
