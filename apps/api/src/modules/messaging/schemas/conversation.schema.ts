import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ type: Types.ObjectId, required: true, unique: true, index: true })
  partnerId!: Types.ObjectId;

  @Prop({ default: '' })
  subject!: string;

  @Prop({ type: Types.ObjectId, ref: 'Message', default: null })
  lastMessageId!: Types.ObjectId | null;

  @Prop({ default: 0 })
  partnerUnread!: number;

  @Prop({ default: 0 })
  adminUnread!: number;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
