import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IncentiveCampaignDocument = HydratedDocument<IncentiveCampaign>;

@Schema({ timestamps: true, collection: 'incentive_campaigns' })
export class IncentiveCampaign {
  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({ required: true, min: 1 })
  bonusAmount!: number;

  /** Number of completed deliveries a rider must reach within [startsAt, endsAt] to qualify. */
  @Prop({ required: true, min: 1 })
  thresholdDeliveries!: number;

  @Prop({ required: true })
  startsAt!: Date;

  @Prop({ required: true })
  endsAt!: Date;

  @Prop({ default: true })
  isActive!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export const IncentiveCampaignSchema = SchemaFactory.createForClass(IncentiveCampaign);
