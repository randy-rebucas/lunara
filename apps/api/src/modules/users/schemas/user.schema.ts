import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { UserRole } from '@lunara/types';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ unique: true, sparse: true })
  email?: string;

  @Prop({ unique: true, sparse: true })
  phone?: string;

  @Prop()
  passwordHash?: string;

  @Prop({ required: true, enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Prop({ type: Types.ObjectId, index: true })
  branchId?: Types.ObjectId;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  lastLoginAt?: Date;

  /** Partner-only: display name of the shop owner, separate from the login email. */
  @Prop()
  ownerName?: string;

  /** Partner-only: subscription tier for the shop's partner portal access. */
  @Prop({ enum: ['trial', 'basic', 'starter', 'professional'] })
  subscriptionPlan?: 'trial' | 'basic' | 'starter' | 'professional';

  /** Partner-only: monthly price (PHP) for the current subscriptionPlan. */
  @Prop()
  planPrice?: number;

  /** Partner-only: next renewal date for a paid plan. */
  @Prop()
  planRenewsAt?: Date;

  /** Partner-only: trial expiry date, set when subscriptionPlan is 'trial'. */
  @Prop()
  trialEndsAt?: Date;

  /** Partner-only: registered business/shop name, separate from the branch name. */
  @Prop()
  businessName?: string;

  /** Partner-only: BIR Tax Identification Number. */
  @Prop()
  tin?: string;

  @Prop()
  businessPermitNumber?: string;

  @Prop({ default: false })
  businessPermitVerified!: boolean;

  @Prop()
  birRegistrationNumber?: string;

  @Prop({ default: false })
  birRegistrationVerified!: boolean;

  /** Partner-only: delivery coverage radius in km, admin-configured (pickup radius lives on Branch.serviceRadiusKm). */
  @Prop()
  deliveryRadiusKm?: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
