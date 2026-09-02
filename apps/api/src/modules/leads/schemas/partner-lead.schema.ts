import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PartnerLeadDocument = HydratedDocument<PartnerLead>;

@Schema({ _id: false })
class PartnerLeadColors {
  @Prop({ required: true })
  primary!: string;

  @Prop({ required: true })
  secondary!: string;

  @Prop({ required: true })
  accent!: string;

  @Prop({ required: true })
  background!: string;

  @Prop({ required: true })
  foreground!: string;

  @Prop({ required: true })
  muted!: string;

  @Prop({ required: true })
  border!: string;

  @Prop({ required: true })
  destructive!: string;
}

@Schema({ _id: false })
class PartnerLeadManifest {
  @Prop({ required: true })
  appName!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop({ required: true })
  iosBundleId!: string;

  @Prop({ required: true })
  androidPackage!: string;

  @Prop({ default: '' })
  easProjectId!: string;

  @Prop({ required: true })
  splashBackgroundColor!: string;
}

@Schema({ timestamps: true, collection: 'partner_leads' })
export class PartnerLead {
  @Prop({ required: true })
  brandName!: string;

  @Prop({ required: true })
  contactName!: string;

  @Prop({ required: true })
  email!: string;

  @Prop()
  phone?: string;

  @Prop()
  region?: string;

  @Prop()
  message?: string;

  @Prop({ required: true })
  logoUrl!: string;

  @Prop({ type: PartnerLeadColors, required: true })
  colors!: PartnerLeadColors;

  /** Precomputed partner-brands/<slug>/manifest.json shape — saved at submission time so
   *  ops can scaffold the real app later without re-deriving bundle IDs or the theme. */
  @Prop({ type: PartnerLeadManifest, required: true })
  manifest!: PartnerLeadManifest;

  @Prop({ default: 'new', enum: ['new', 'contacted', 'archived'] })
  status!: 'new' | 'contacted' | 'archived';

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerLeadSchema = SchemaFactory.createForClass(PartnerLead);
