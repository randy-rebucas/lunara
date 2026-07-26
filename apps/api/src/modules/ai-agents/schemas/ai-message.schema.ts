import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AiMessageDocument = HydratedDocument<AiMessage>;

export type AiMessageRole = 'user' | 'assistant';

@Schema({ timestamps: true, collection: 'ai_messages' })
export class AiMessage {
  @Prop({ required: true, type: Types.ObjectId })
  conversationId!: Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: AiMessageRole;

  @Prop({ required: true })
  content!: string;

  @Prop()
  model?: string;

  @Prop()
  tokensIn?: number;

  @Prop()
  tokensOut?: number;

  createdAt!: Date;
}

export const AiMessageSchema = SchemaFactory.createForClass(AiMessage);
