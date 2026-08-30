import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationChannel } from '@lunara/types';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ required: true, enum: NotificationChannel, default: NotificationChannel.IN_APP })
  channel!: NotificationChannel;

  @Prop({ default: false })
  read!: boolean;

  @Prop({ type: Object })
  data?: Record<string, unknown>;

  /** Drives the TTL index below — MongoDB deletes the document itself once this passes, no cron
   * sweep needed. Kept far out (90 days) while unread since the user may not have opened the app
   * yet; pulled in to 30 days as soon as `read` flips true (see the pre-save hook below and
   * ReviewsService.markAllNotificationsRead, which updates it directly since `updateMany` skips
   * document middleware). */
  @Prop({ type: Date })
  expiresAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

const READ_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const UNREAD_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export function notificationExpiryFor(read: boolean, from = new Date()): Date {
  return new Date(from.getTime() + (read ? READ_RETENTION_MS : UNREAD_RETENTION_MS));
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

NotificationSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('read')) {
    this.expiresAt = notificationExpiryFor(this.read);
  }
  next();
});
