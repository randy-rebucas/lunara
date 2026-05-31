import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PushPlatform } from '@lunara/types';

export type PushTokenDocument = HydratedDocument<PushToken>;

@Schema({ timestamps: true, collection: 'push_tokens' })
export class PushToken {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  token!: string;

  @Prop({ required: true, enum: PushPlatform })
  platform!: PushPlatform;

  @Prop()
  deviceId?: string;
}

export const PushTokenSchema = SchemaFactory.createForClass(PushToken);
PushTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
