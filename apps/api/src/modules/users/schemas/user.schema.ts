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

  @Prop({ required: true, enum: UserRole, default: UserRole.CUSTOMER, index: true })
  role!: UserRole;

  @Prop({ type: Types.ObjectId, index: true })
  branchId?: Types.ObjectId;

  @Prop({ default: true })
  isActive!: boolean;

  /** Set once the user clicks the link in their verification email. Defaults true — only the
   * self-serve /auth/register flow explicitly sets this false while the link is unconfirmed;
   * every other creation path (admin invites, partner/rider onboarding, phone OTP signup) is
   * exempt from the verification gate since those accounts aren't self-registered by email. */
  @Prop({ default: true })
  isEmailVerified!: boolean;

  @Prop()
  emailVerifiedAt?: Date;

  @Prop()
  lastLoginAt?: Date;

  /** Internal team members only (admin/staff): free-text department/team label. */
  @Prop()
  department?: string;

  /** Profile photo URL — Cloudinary secure_url, or unset to fall back to initials. */
  @Prop()
  photoUrl?: string;

  /** Partner-only: display name of the shop owner, separate from the login email. */
  @Prop()
  ownerName?: string;

  /** @deprecated Superseded by billing.Subscription (see apps/api/src/modules/billing) —
   * read-only, retained for the migrate-billing-subscriptions.ts backfill and as a fallback
   * until it's confirmed no other code still reads these. Do not write to these fields. */
  @Prop({ enum: ['trial', 'basic', 'starter', 'professional'] })
  subscriptionPlan?: 'trial' | 'basic' | 'starter' | 'professional';

  /** @deprecated See subscriptionPlan above — superseded by Subscription.priceSnapshot. */
  @Prop()
  planPrice?: number;

  /** @deprecated See subscriptionPlan above — superseded by Subscription.currentPeriodEnd. */
  @Prop()
  planRenewsAt?: Date;

  /** @deprecated See subscriptionPlan above — superseded by Subscription.trialEndsAt. */
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

  /** Partner-only: the PartnerApplication this account was onboarded from, if any — lets admin
   * trace a live partner back to the application that led to it. Unset for partners onboarded
   * without going through the public application flow (e.g. direct admin-created accounts). */
  @Prop({ type: Types.ObjectId })
  sourceApplicationId?: Types.ObjectId;

  /** Staff-only: when true, this staff account can edit shop settings (hours,
   * pricing, etc.) in addition to normal order-processing actions. Ignored for PARTNER/ADMIN,
   * who always have full access. Defaults to view-only. */
  @Prop({ default: false })
  canManageSettings!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
// Backs date-range queries used by admin reports (e.g. new customers/riders joined in a period).
UserSchema.index({ createdAt: -1 });
