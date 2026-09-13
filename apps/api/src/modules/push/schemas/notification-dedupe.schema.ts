import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDedupeDocument = HydratedDocument<NotificationDedupe>;

/**
 * DB-backed dedup window for order/rider notification fan-out, replacing a per-process in-memory
 * Map — a Map only dedupes within one API instance, so a duplicate event routed to a different
 * instance/pod within the window would still double-notify. `key` is unique-indexed; a claim is
 * an atomic findOneAndUpdate that only succeeds when no unexpired doc for the key exists yet
 * (see NotificationDedupeService.claim). `expiresAt` also drives an eventual TTL cleanup so this
 * collection doesn't grow unbounded.
 */
@Schema({ collection: 'notification_dedupe_markers' })
export class NotificationDedupe {
  @Prop({ required: true })
  key!: string;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const NotificationDedupeSchema = SchemaFactory.createForClass(NotificationDedupe);
NotificationDedupeSchema.index({ key: 1 }, { unique: true });
NotificationDedupeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
