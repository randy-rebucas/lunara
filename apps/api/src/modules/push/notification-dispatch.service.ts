import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationChannel } from '@lunara/types';
import {
  Notification,
  NotificationDocument,
} from '../reviews/schemas/notification.schema';
import { PushNotificationService, type PushPayload } from './push-notification.service';

export interface DispatchNotificationInput {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  /** Set false to skip the push send while still recording the in-app notification —
   * used to respect a customer's "push notifications" preference. Defaults to true. */
  sendPush?: boolean;
}

@Injectable()
export class NotificationDispatchService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private pushNotificationService: PushNotificationService,
  ) {}

  async dispatch(input: DispatchNotificationInput) {
    const notification = await this.notificationModel.create({
      userId: new Types.ObjectId(input.userId),
      title: input.title,
      body: input.body,
      channel: NotificationChannel.IN_APP,
      read: false,
      data: input.data,
    });

    if (input.sendPush !== false) {
      const pushPayload: PushPayload = {
        title: input.title,
        body: input.body,
        data: input.data,
        channelId: input.channelId,
      };
      void this.pushNotificationService.sendToUser(input.userId, pushPayload);
    }

    return notification;
  }
}
