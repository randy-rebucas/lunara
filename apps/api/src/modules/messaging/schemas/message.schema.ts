import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ _id: false })
class AttachmentSubdoc {
  @Prop({ required: true }) filename!: string;
  @Prop({ required: true }) url!: string;
  @Prop({ required: true }) mimeType!: string;
  @Prop({ required: true }) size!: number;
}

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  senderId!: Types.ObjectId;

  @Prop({ required: true })
  senderRole!: string;

  @Prop({ required: true })
  senderName!: string;

  @Prop({ default: '' })
  content!: string;

  @Prop({ type: [AttachmentSubdoc], default: [] })
  attachments!: AttachmentSubdoc[];

  @Prop({ type: Date, default: null })
  readAt!: Date | null;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
