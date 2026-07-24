import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CampaignCreditDocument = HydratedDocument<CampaignCredit>;

/** One row per rider per campaign they've been credited for — prevents double-crediting
 * across cron sweeps. */
@Schema({ timestamps: true, collection: 'campaign_credits' })
export class CampaignCredit {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  campaignId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  riderId!: Types.ObjectId;

  @Prop({ required: true })
  deliveryCountAtCredit!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CampaignCreditSchema = SchemaFactory.createForClass(CampaignCredit);

CampaignCreditSchema.index({ campaignId: 1, riderId: 1 }, { unique: true });
