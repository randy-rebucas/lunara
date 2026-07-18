import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BroadcastNotificationDocument = HydratedDocument<BroadcastNotification>;

@Schema({ timestamps: true, collection: 'broadcast_notifications' })
export class BroadcastNotification {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ required: true })
  audience!: string;

  @Prop({ required: true })
  sentCount!: number;

  @Prop({ type: Types.ObjectId, required: true })
  createdBy!: Types.ObjectId;

  @Prop()
  createdByName?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const BroadcastNotificationSchema = SchemaFactory.createForClass(BroadcastNotification);
BroadcastNotificationSchema.index({ createdAt: -1 });
