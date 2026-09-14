import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

export type ConversationCounterpartyType = 'admin' | 'employer';

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  partnerId!: Types.ObjectId;

  // 'admin' = thread with Lunara support (legacy default). 'employer' = a rider/staff member's
  // direct thread with their connected partner (employer). Combined with partnerId this forms
  // the real uniqueness key, since one owner can now have both an admin thread and an employer
  // thread at once.
  @Prop({ type: String, enum: ['admin', 'employer'], required: true, default: 'admin' })
  counterpartyType!: ConversationCounterpartyType;

  // Set only when counterpartyType === 'employer' — the partner (employer) userId this thread's
  // owner (rider or staff member) reports to.
  @Prop({ type: Types.ObjectId, default: null })
  employerId!: Types.ObjectId | null;

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
ConversationSchema.index({ partnerId: 1, counterpartyType: 1 }, { unique: true });
ConversationSchema.index({ employerId: 1 }, { sparse: true });
