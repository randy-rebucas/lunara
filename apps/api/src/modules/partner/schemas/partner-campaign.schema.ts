import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PartnerCampaignDocument = HydratedDocument<PartnerCampaign>;

@Schema({ timestamps: true, collection: 'partner_campaigns' })
export class PartnerCampaign {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerUserId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ required: true })
  recipientCount!: number;

  @Prop({ required: true })
  sentCount!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const PartnerCampaignSchema = SchemaFactory.createForClass(PartnerCampaign);
PartnerCampaignSchema.index({ partnerUserId: 1, createdAt: -1 });
