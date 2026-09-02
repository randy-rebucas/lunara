import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type PartnerAppConfigDocument = HydratedDocument<PartnerAppConfig>;

@Schema({ _id: false })
class AppConfigTheme {
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
class AppConfigBlock {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  order!: number;

  /** Validated against the zod schema in @lunara/blocks at the service layer, not here —
   *  keeps this schema stable as new block types are added. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  props!: Record<string, unknown>;
}

@Schema({ _id: false })
class AppConfigScreen {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  key!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ type: [AppConfigBlock], default: [] })
  blocks!: AppConfigBlock[];
}

@Schema({ timestamps: true, collection: 'partner_app_configs' })
export class PartnerAppConfig {
  @Prop({ required: true, index: true })
  partnerId!: string;

  @Prop({ required: true, index: true })
  slug!: string;

  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop({ required: true, default: 'draft', enum: ['draft', 'published'] })
  status!: 'draft' | 'published';

  @Prop({ type: AppConfigTheme, required: true })
  theme!: AppConfigTheme;

  @Prop({ type: [AppConfigScreen], default: [] })
  screens!: AppConfigScreen[];

  @Prop({ required: false, enum: ['tabs', 'drawer'], default: 'tabs' })
  navStyle?: 'tabs' | 'drawer';

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerAppConfigSchema = SchemaFactory.createForClass(PartnerAppConfig);
PartnerAppConfigSchema.index({ slug: 1, status: 1, version: -1 });
