import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PartnerDocument = HydratedDocument<Partner>;

@Schema({ _id: false })
class PartnerBrandColors {
  @Prop({ default: '#4f46e5' })
  primary!: string;

  @Prop({ default: '#06b6d4' })
  secondary!: string;

  @Prop({ default: '#22c55e' })
  accent!: string;

  @Prop({ default: '#ffffff' })
  background!: string;

  @Prop({ default: '#0f172a' })
  foreground!: string;

  @Prop({ default: '#64748b' })
  muted!: string;

  @Prop({ default: '#e2e8f0' })
  border!: string;

  @Prop({ default: '#ef4444' })
  destructive!: string;
}

@Schema({ _id: false })
class PartnerBrandFonts {
  @Prop({ default: 'Inter' })
  sans!: string;

  @Prop()
  heading?: string;
}

@Schema({ _id: false })
class PartnerBrandMobileBundleId {
  @Prop()
  ios?: string;

  @Prop()
  android?: string;
}

@Schema({ _id: false })
export class PartnerBrandConfig {
  @Prop({ unique: true, sparse: true })
  domain?: string;

  @Prop({ default: false })
  customDomainVerified!: boolean;

  @Prop({ default: 'Lunara' })
  appDisplayName!: string;

  @Prop({ type: PartnerBrandColors, default: () => ({}) })
  colors!: PartnerBrandColors;

  @Prop({ type: PartnerBrandFonts, default: () => ({}) })
  fonts!: PartnerBrandFonts;

  @Prop()
  logoUrl?: string;

  @Prop()
  iconUrl?: string;

  @Prop()
  splashUrl?: string;

  @Prop()
  faviconUrl?: string;

  @Prop({ type: PartnerBrandMobileBundleId })
  mobileBundleId?: PartnerBrandMobileBundleId;

  @Prop({ default: 'draft', enum: ['draft', 'pending_review', 'live'] })
  status!: 'draft' | 'pending_review' | 'live';
}

@Schema({ timestamps: true, collection: 'partners' })
export class Partner {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  ownerUserId!: Types.ObjectId;

  @Prop({ required: true })
  legalName!: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ type: PartnerBrandConfig, default: () => ({}) })
  brandConfig!: PartnerBrandConfig;

  @Prop({ default: true })
  isActive!: boolean;

  /** True once this partner has a dedicated database provisioned (set when brandConfig.status
   * first becomes 'live' or a PartnerTerritory is created — see PartnerProvisioningService).
   * Regular shop partners without this stay on the shared database. */
  @Prop({ default: false })
  hasDedicatedDb!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerSchema = SchemaFactory.createForClass(Partner);
