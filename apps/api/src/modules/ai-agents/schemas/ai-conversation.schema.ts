import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AiConversationDocument = HydratedDocument<AiConversation>;

@Schema({ timestamps: true, collection: 'ai_conversations' })
export class AiConversation {
  @Prop({ required: true })
  agentId!: string;

  @Prop({ required: true, type: Types.ObjectId })
  userId!: Types.ObjectId;

  @Prop()
  title?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AiConversationSchema = SchemaFactory.createForClass(AiConversation);
