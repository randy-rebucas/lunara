import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type WebhookEventDocument = HydratedDocument<WebhookEvent>;

/**
 * Idempotency + audit log for inbound payment-provider webhooks. Same claim-first-then-process
 * pattern as LedgerTransactionMarker (apps/api/src/modules/ledger/schemas/ledger-entry.schema.ts):
 * insert a uniquely-indexed doc before doing any side-effecting work, catch the duplicate-key
 * error on a redelivery and no-op instead of reprocessing.
 */
@Schema({ timestamps: true, collection: 'payment_webhook_events' })
export class WebhookEvent {
  /** Kept as a field (not hardcoded to 'paymongo') for future payment providers. */
  @Prop({ required: true })
  provider!: string;

  /** The webhook envelope's own resource id (PayMongo: top-level `data.id`) — distinct from
   * the nested payment/session resource id the event is about. */
  @Prop({ required: true })
  eventId!: string;

  @Prop({ required: true })
  eventType!: string;

  /** Raw parsed webhook body, for replay/audit. */
  @Prop({ type: Object })
  payload!: Record<string, unknown>;

  @Prop({ default: false })
  processed!: boolean;

  @Prop()
  processedAt?: Date;

  @Prop()
  processingError?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);
WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
