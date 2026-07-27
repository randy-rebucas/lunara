import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AiGuestUsageDocument = HydratedDocument<AiGuestUsage>;

/**
 * Daily message-count bucket for unauthenticated (guest) chat traffic — guest chats are
 * stateless and store no content/identity, so this is the only usage signal for them.
 */
@Schema({ timestamps: false, collection: 'ai_guest_usage' })
export class AiGuestUsage {
  @Prop({ required: true })
  agentId!: string;

  /** Day bucket, `YYYY-MM-DD` (UTC). */
  @Prop({ required: true })
  date!: string;

  @Prop({ required: true, default: 0 })
  count!: number;
}

export const AiGuestUsageSchema = SchemaFactory.createForClass(AiGuestUsage);
AiGuestUsageSchema.index({ agentId: 1, date: 1 }, { unique: true });
